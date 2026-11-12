import type { ChangelogEntry } from "@/api/systemApi";

const parseVersion = (v: string): number[] =>
  String(v || "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

/** 1 kalau a lebih baru dari b, -1 kalau lebih lama, 0 kalau sama. */
export const compareVersion = (a: string, b: string): number => {
  const x = parseVersion(a);
  const y = parseVersion(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
};

/** Catatan rilis yang lebih baru dari versi terakhir yang dibaca user. */
export const entriesSince = (
  history: ChangelogEntry[],
  seen: string,
): ChangelogEntry[] => history.filter((e) => compareVersion(e.version, seen) > 0);

export interface VisibleReleases {
  visible: ChangelogEntry[];
  hiddenCount: number;
  noteCount: number;
}

/**
 * Tentukan rilis yang ditampilkan di panel "Apa yang Baru".
 *
 * Rilis yang belum dibaca user selalu tampil. Sisanya arsip: cukup yang
 * terbaru, selebihnya di balik satu tombol, supaya riwayat 10 versi tidak
 * menjadi dinding teks yang harus digulir user. `showArchive` membuka semua.
 */
export const visibleReleases = (
  all: ChangelogEntry[],
  unreadVersions: string[],
  showArchive = false,
): VisibleReleases => {
  const countNotes = (list: ChangelogEntry[]) =>
    list.reduce((n, e) => n + e.notes.length, 0);

  if (showArchive || all.length <= 1) {
    return { visible: all, hiddenCount: 0, noteCount: countNotes(all) };
  }

  const unread = all.filter((e) => unreadVersions.includes(e.version));
  const visible = unread.length > 0 ? unread : all.slice(0, 1);

  return {
    visible,
    hiddenCount: all.length - visible.length,
    noteCount: countNotes(visible),
  };
};
