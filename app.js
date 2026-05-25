import {initMap} from './map.js';
import {initUI} from './ui.js';
import {initAuth} from './auth.js';
import {initSidebar} from './sidebar.js';

window.onload=()=>{
 initAuth();
 initSidebar();
 initUI();
 initMap();
};