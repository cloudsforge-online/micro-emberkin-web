// Ordered team of up to six Kin with an active member. Mirrors Kindred.Core.Party.

export class Party {
  static MaxSize = 6;
  constructor() { this.members = []; this.activeIndex = 0; }

  get active() { return this.members[this.activeIndex]; }
  get count() { return this.members.length; }
  get isEmpty() { return this.members.length === 0; }

  add(kin) {
    if (this.members.length >= Party.MaxSize) return false;
    this.members.push(kin);
    return true;
  }

  get hasFightableKin() { return this.members.some(k => !k.isFainted); }

  switchTo(index) {
    if (index < 0 || index >= this.members.length || this.members[index].isFainted || index === this.activeIndex)
      return false;
    this.activeIndex = index;
    return true;
  }

  firstHealthyIndex() {
    for (let i = 0; i < this.members.length; i++) if (!this.members[i].isFainted) return i;
    return -1;
  }

  clear() { this.members = []; this.activeIndex = 0; }
  healAll() { for (const k of this.members) k.fullRestore(); }
  resetBattleState() { for (const k of this.members) k.resetBattleState(); }
}
