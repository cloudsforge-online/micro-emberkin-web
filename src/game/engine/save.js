// Save/load to localStorage. Mirrors Kindred.Core.Save.SaveGame.
import { Kin } from "./kin.js";

const KEY = "kindred.save.v1";

export function kinToSave(k) {
  return {
    speciesId: k.species.id,
    nickname: k.hasCustomNickname ? k.nickname : null,
    level: k.level, xp: k.xp, resonance: k.resonance, temperament: k.temperament,
    attunement: { ...k.attunement }, moves: [...k.moves], heldItem: k.heldItem,
    currentHp: k.currentHp, status: k.status,
  };
}

export function kinFromSave(s, data) {
  const k = new Kin(data.getSpecies(s.speciesId));
  if (s.nickname) k.nickname = s.nickname;
  k.level = s.level; k.xp = s.xp; k.resonance = s.resonance; k.temperament = s.temperament;
  k.attunement = { ...s.attunement }; k.moves = [...s.moves]; k.heldItem = s.heldItem;
  k.status = s.status || "None";
  k.currentHp = s.currentHp > 0 ? Math.min(s.currentHp, k.maxHp) : k.maxHp;
  return k;
}

export function saveGame(state) {
  const payload = {
    version: 1,
    wardenName: state.wardenName,
    currentRegion: state.currentRegion,
    storyProgress: state.storyProgress,
    party: state.party.members.map(kinToSave),
    box: state.box.map(kinToSave),
    inventory: { ...state.bag },
    seals: [...state.seals],
    seen: [...(state.seen || [])],
  };
  try { localStorage.setItem(KEY, JSON.stringify(payload)); return true; }
  catch (e) { console.warn("save failed", e); return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadGame(data) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      wardenName: p.wardenName, currentRegion: p.currentRegion, storyProgress: p.storyProgress || 0,
      party: p.party.map(s => kinFromSave(s, data)),
      box: (p.box || []).map(s => kinFromSave(s, data)),
      bag: p.inventory || {}, seals: new Set(p.seals || []), seen: new Set(p.seen || []),
    };
  } catch (e) { console.warn("load failed", e); return null; }
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }
