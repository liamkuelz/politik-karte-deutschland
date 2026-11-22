import { h } from './dom.ts';

export interface Column {
  label: string;
  /** rechtsbuendige Zahlenspalte */
  num?: boolean;
}

/** Tabelle mit Kopfzeile (th scope="col") und leerem tbody, der vom Aufrufer gefuellt wird. */
export function renderTable(columns: Column[], cls = 'dash-table'): { table: HTMLTableElement; body: HTMLTableSectionElement } {
  const table = h('table', cls);
  const head = h('tr');
  for (const c of columns) {
    const th = h('th', c.num ? 'num' : undefined, c.label);
    th.scope = 'col';
    head.append(th);
  }
  const thead = h('thead');
  thead.append(head);
  const body = h('tbody');
  table.append(thead, body);
  return { table, body };
}
