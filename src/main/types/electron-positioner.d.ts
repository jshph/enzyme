declare module 'electron-positioner' {
  import { BrowserWindow } from 'electron';

  class Positioner {
    constructor(browserWindow: BrowserWindow);
    move(position: string): void;
    calculate(position: string): { x: number; y: number };
  }

  export default Positioner;
}