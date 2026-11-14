export const colors = ["#124b33","#176b45","#388754","#659e76","#8bb597","#b6d5bd"];

export const format = (n: number) => n.toLocaleString();

export const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not synced yet";
