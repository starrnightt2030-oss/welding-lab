import { startApp } from './core/app.js';
import smaw from './stations/smaw.js';
import oaw from './stations/oaw.js';
import tig from './stations/tig.js';
import makeWire from './stations/mig.js';
import caw from './stations/caw.js';
import safety from './stations/safety.js';

startApp([safety, smaw, oaw, caw, makeWire('co2'), tig, makeWire('mig')]);
