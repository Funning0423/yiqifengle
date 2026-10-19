import { Color, Label, Node, UITransform } from 'cc';
import { setDialogCameraOpen } from '../world-r1/DialogCameraYield';

export type DialogLine = { speaker?: string; text: string };

/** U2 sea-breeze bubble, dev entry until a story script exists.
 *  Opening calls setDialogCameraOpen(true); close and dispose call it false.
 *  Play one page at a time: __dialogDemo() shows the first line, another play replaces it,
 *  __dialogDemo(false) closes. Skirt colour and the tail art are checked in engine after the slices land. */
export class DialogBubble {
  private readonly root: Node;
  private readonly label: Label;
  private open = false;
  private done: (() => void) | undefined;
  constructor(parent: Node) {
    this.root = new Node('DialogBubble');
    parent.addChild(this.root);
    const ui = this.root.addComponent(UITransform);
    ui.setContentSize(362, 122);
    this.label = this.root.addComponent(Label);
    this.label.fontSize = 17;
    this.label.lineHeight = 26;
    this.label.color = new Color(92, 62, 40, 255);
    this.label.overflow = Label.Overflow.RESIZE_HEIGHT;
    this.root.active = false;
  }
  play(lines: DialogLine[], done?: () => void) {
    const line = lines && lines.length ? lines[0] : { text: '' };
    const who = line.speaker ? line.speaker + '：' : '';
    this.label.string = who + (line.text || '');
    this.open = true;
    this.root.active = true;
    this.done = done;
    setDialogCameraOpen(true);
  }
  visible(): boolean { return this.open; }
  update(_dt: number, _width: number, _height: number) {}
  close() {
    if (!this.open && !this.root.active) { setDialogCameraOpen(false); return; }
    this.open = false;
    this.root.active = false;
    setDialogCameraOpen(false);
    const done = this.done;
    this.done = undefined;
    if (done) done();
  }
  dispose() { this.close(); if (this.root.isValid) this.root.destroy(); }
}
