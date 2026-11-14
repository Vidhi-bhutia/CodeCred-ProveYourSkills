import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {Ctx} from '../src/context.tsx';
import {Repositories} from '../src/pages/Repositories.tsx';
import {Dashboard} from '../src/pages/Dashboard.tsx';
const context={user:{id:'test',displayName:'Test Developer',username:'test-dev',avatar:'',views:0,connected:true},version:0,changed:()=>{},notify:()=>{},importRepos:()=>{}};
const render=component=>renderToStaticMarkup(React.createElement(Ctx.Provider,{value:context},React.createElement(MemoryRouter,null,React.createElement(component))));
test('no featured repositories renders a useful empty state with the add action',()=>{
  const html=render(Repositories);assert.match(html,/Add Featured Repository/);assert.match(html,/analytics work with no featured repositories/);assert.doesNotMatch(html,/three repositories|of 3 selected|Import selected/);
});
test('dashboard offers account analytics refresh independently of featured selection',()=>{
  const html=render(Dashboard);assert.match(html,/Refresh GitHub Analytics/);assert.match(html,/Eligible repositories/);assert.match(html,/Featured repositories/);
});
function luminance(hex){return hex.match(/\w\w/g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((n,value,i)=>n+value*[.2126,.7152,.0722][i],0);}
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
test('primary, secondary and muted text meet 4.5:1 on light surfaces, including green tags',()=>{
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  for(const color of ['17231d','53645a','5b6d60']){assert.ok(css.includes('#'+color));for(const background of ['ffffff','f7f9f6','eaf4ed'])assert.ok(contrast(color,background)>=4.5,`${color} on ${background}`);}
  assert.ok(contrast('ffffff','176b45')>=4.5);assert.ok(contrast('315b3e','eaf4ed')>=4.5);
  assert.doesNotMatch(css,/font-size:\s*(?:[7-9]|10|11)px;/);
  assert.match(css,/@media\s*\(max-width:\s*650px\)/);assert.match(css,/@media\s*\(max-width:\s*900px\)/);
});
