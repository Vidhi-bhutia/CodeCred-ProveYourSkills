export const colors = [
  "#255d49",
  "#7da88e",
  "#a8c4a2",
  "#d0b986",
  "#99b1bf",
  "#b6a0c2",
];

export const format = (n: number) => n.toLocaleString();

export const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not synced yet";
