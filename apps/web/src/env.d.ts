/// <reference types="astro/client" />

declare module "*?worker" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
