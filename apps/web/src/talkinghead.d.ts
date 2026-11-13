// Type shim for TalkingHead — loaded at runtime from /lib/talkinghead.mjs
// (served from public folder, resolved via browser import-map for Three.js)
declare module '*/talkinghead.mjs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const TalkingHead: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default any;
}

