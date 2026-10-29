import { startApp } from './core/app.js';
import { ICON } from './core/icons.js';
import smaw from './stations/smaw.js';
import oaw from './stations/oaw.js';
import tig from './stations/tig.js';
import mig from './stations/mig.js';
import caw from './stations/caw.js';
import safety from './stations/safety.js';

const FIVE = [['explore', 'اتعرّف'], ['assemble', 'ركّب'], ['operate', 'شغّل'], ['weld', 'الحم'], ['inspect', 'افحص']];
const soon = (id, name, code, icon, stages = FIVE) => ({ id, name, code, icon, ready: false, stages });

startApp([
  safety,
  smaw,
  oaw,
  caw,
  tig,
  mig
]);
