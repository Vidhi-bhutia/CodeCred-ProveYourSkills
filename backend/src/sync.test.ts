import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performSync,featurePatch,type SyncSource,type SyncStore} from './sync-core.js';
import {aggregate} from './analytics.js';
import {HttpError} from './github.js';

function fixture(count:number) {
  const upstream=Array.from({length:count},(_,i)=>({id:i+1,name:`repo-${i+1}`,full_name:`owner/repo-${i+1}`,private:false,visibility:'public',pushed_at:'2026-11-01T00:00:00Z'}));
  const records=new Map<number,any>();const progress:Record<string,any>={};const pages:number[]=[];let analyses=0;
  const store:SyncStore={
    checkpoint:async()=>{},progress:async patch=>{Object.assign(progress,patch);},
    discover:async(repos,run)=>{for(const repo of repos){const prior=records.get(repo.id);records.set(repo.id,{_id:repo.id,githubId:repo.id,status:'pending',featured:false,...prior,seenRun:run,eligible:true});}},
    finishDiscovery:async run=>{for(const record of records.values())if(record.seenRun!==run)record.eligible=false;},
    next:async run=>[...records.values()].find(repo=>repo.seenRun===run&&repo.eligible&&repo.processedRun!==run)||null,
    save:async(id,patch)=>{Object.assign(records.get(Number(id)),patch);},
    counts:async run=>{const repos=[...records.values()].filter(repo=>repo.seenRun===run);return {discovered:repos.length,analyzed:repos.filter(repo=>repo.processedRun===run&&repo.status==='ready').length,skipped:repos.filter(repo=>repo.processedRun===run&&repo.status==='skipped').length,processed:repos.filter(repo=>repo.processedRun===run).length};},
  };
  const source:SyncSource={
    page:async page=>{pages.push(page);return {data:upstream.slice((page-1)*30,page*30),next:page*30<upstream.length?page+1:null};},
    repository:async id=>upstream.find(repo=>repo.id===id),
    analyze:async()=>{analyses++;return {loc:10,languages:{TypeScript:10},tags:['TypeScript']};},
    activity:async()=>({commits:2,pullRequests:1,mergedPullRequests:1,issues:0,closedIssues:0,contributors:2,dailyCommits:{}}),
  };
  return {store,source,records,progress,pages,analyses:()=>analyses};
}
for(const count of [1,15,50,100])test(`${count} repositories are automatically discovered and analyzed, independent of featuring`,async()=>{
  const f=fixture(count);await performSync({run:'first',page:1,phase:'discovering'},f.store,f.source);
  assert.equal(f.records.size,count);assert.equal(f.progress.analyzed,count);assert.equal(f.progress.state,'completed');
  const stats=aggregate([...f.records.values()]);assert.equal(stats.repositoryCount,count);assert.equal(stats.totalLoc,count*10);assert.equal(stats.featuredCount,0);
  assert.equal(f.pages.length,Math.ceil(count/30));assert.equal(f.analyses(),count);
});
test('featuring three of fifteen, reordering, and removing one preserve all analytics',async()=>{
  const f=fixture(15);await performSync({run:'first',page:1,phase:'discovering'},f.store,f.source);
  for(const id of [1,2,3])Object.assign(f.records.get(id),featurePatch(true,id));
  assert.equal(aggregate([...f.records.values()]).featuredCount,3);
  const before=aggregate([...f.records.values()]);Object.assign(f.records.get(2),featurePatch(false));Object.assign(f.records.get(3),featurePatch(true,0));
  const after=aggregate([...f.records.values()]);assert.equal(after.featuredCount,2);assert.equal(after.totalLoc,before.totalLoc);assert.deepEqual(after.languages,before.languages);assert.equal(after.commits,before.commits);
  assert.deepEqual(Object.keys(featurePatch(false)).sort(),['featured','featuredOrder','pinned']);
});
test('refresh upserts stable identities, reuses unchanged source, and replaces activity without duplication',async()=>{
  const f=fixture(15);await performSync({run:'first',page:1,phase:'discovering'},f.store,f.source);
  Object.assign(f.records.get(1),featurePatch(true,4));
  await performSync({run:'refresh',page:1,phase:'discovering'},f.store,f.source);
  assert.equal(f.records.size,15);assert.equal(f.analyses(),15);assert.equal(aggregate([...f.records.values()]).commits,30);assert.equal(f.records.get(1).featured,true);
});
test('rate-limit pause preserves finished work and resumes the durable cursor',async()=>{
  const f=fixture(3);const original=f.source.repository;let reject=true;
  f.source.repository=async id=>{if(id===2&&reject)throw new HttpError(429,'Rate limited',new Date(Date.now()+60000));return original(id);};
  await assert.rejects(performSync({run:'first',page:1,phase:'discovering'},f.store,f.source),/Rate limited/);
  assert.equal(f.progress.phase,'analyzing');assert.equal(f.records.get(1).processedRun,'first');
  reject=false;await performSync({run:'first',page:1,phase:'analyzing'},f.store,f.source);
  assert.equal(f.progress.analyzed,3);assert.equal(f.analyses(),3);assert.equal(aggregate([...f.records.values()]).totalLoc,30);
});
test('unsupported repositories have visible reasons and publish no partial LOC',async()=>{
  const f=fixture(2);f.source.analyze=async repo=>{if(repo.id===1)throw new HttpError(422,'Repository exceeds source-file limit.');return {loc:10,languages:{Python:10},tags:[]};};
  await performSync({run:'first',page:1,phase:'discovering'},f.store,f.source);
  assert.equal(f.progress.skipped,1);assert.match(f.records.get(1).error,/source-file limit/);assert.equal(aggregate([...f.records.values()]).totalLoc,10);
});
test('repositories becoming private are excluded without deleting presentation choices or cached evidence',async()=>{
  const f=fixture(1);await performSync({run:'first',page:1,phase:'discovering'},f.store,f.source);Object.assign(f.records.get(1),featurePatch(true));
  f.source.repository=async()=>({private:true});await performSync({run:'second',page:1,phase:'discovering'},f.store,f.source);
  assert.equal(f.records.get(1).featured,true);assert.equal(f.records.get(1).loc,10);assert.equal(aggregate([...f.records.values()]).repositoryCount,0);
});
