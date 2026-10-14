/* Scaffali: dove si trovano (cantina o casa) e zone di temperatura dei frigoriferi. */
const isFridgeName = (n) => /frigo|cantinett|climatizz/i.test(n || '');
function shelfLoc(s) { return s.loc || (isFridgeName(s.name) ? 'casa' : 'cantina'); }
// zone di temperatura: per un frigorifero senza impostazioni, metà alta a 12 °C e metà bassa a 14 °C
function shelfZones(s) {
  if (Array.isArray(s.zones)) return s.zones;
  if (shelfLoc(s) !== 'casa' || !isFridgeName(s.name)) return [];
  const h = Math.ceil(s.rows / 2);
  return [{ from: 0, to: h - 1, t: 12 }, { from: h, to: s.rows - 1, t: 14 }];
}
