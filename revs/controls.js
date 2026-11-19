/* Shared desktop/browser editor. Physical samples and field layout come from
 * the SDL host, rather than model-specific or browser-specific axis guesses. */
(() => {
  'use strict';
  const embedded = window.parent !== window && !!window.parent.revsControlsSession;
  const deviceEvents = embedded ? window.parent : window;
  const session = () => window.parent.revsControlsSession;
  const $ = id => document.getElementById(id);
  let state, profile, fields, view, learning = null, busy = false, finished = false;
  let deviceSignature = '', lastButtons = new Map();
  let pollTimer, polling = false, pollAgain = false;
  const roleFields = {
    steering: ['device_guid', 'device_type', 'device_ordinal'],
    pedal: ['pedal_device_guid', 'pedal_device_type', 'pedal_device_ordinal'],
    shifter: ['shifter_device_guid', 'shifter_device_type', 'shifter_device_ordinal']
  };
  const axes = {
    steering_axis: ['Steering', 'steering', 'Centre the wheel/stick, then turn fully RIGHT first and fully LEFT.', 'steering_left', 'steering_right'],
    throttle_axis: ['Throttle', 'pedal', 'Start RELEASED, then press the throttle fully.', 'throttle_released', 'throttle_pressed'],
    brake_axis: ['Brake', 'pedal', 'Start RELEASED, then press the brake fully.', 'brake_released', 'brake_pressed'],
    clutch_axis: ['Clutch (optional)', 'pedal', 'Start RELEASED, then press the clutch fully.', 'clutch_released', 'clutch_pressed']
  };
  const buttons = {
    left_button: ['Digital left', 'steering'], right_button: ['Digital right', 'steering'],
    fast_button: ['Fast steering', 'steering'], clutch_button: ['Clutch button', 'steering'],
    engine_start_button: ['Start engine', 'steering'], pause_button: ['Pause / menu', 'steering'],
    throttle_button: ['Throttle button', 'pedal'], brake_button: ['Brake button', 'pedal'],
    gear_down_button: ['Gear down', 'shifter'], gear_up_button: ['Gear up', 'shifter']
  };
  const keyboard = ['Steer left', 'Steer right', 'Fast steer', 'Throttle', 'Brake', 'Gear up', 'Gear down', 'Start engine', 'Pause (with Shift)', 'Resume (with Shift)'];
  const keyCodes = {Enter:40,Escape:41,Backspace:42,Tab:43,Space:44,Minus:45,Equal:46,BracketLeft:47,BracketRight:48,Backslash:49,Semicolon:51,Quote:52,Backquote:53,Comma:54,Period:55,Slash:56,CapsLock:57,PrintScreen:70,ScrollLock:71,Pause:72,Insert:73,Home:74,PageUp:75,Delete:76,End:77,PageDown:78,ArrowRight:79,ArrowLeft:80,ArrowDown:81,ArrowUp:82};
  for(let i=0;i<26;i++) keyCodes['Key'+String.fromCharCode(65+i)] = 4+i;
  for(let i=1;i<=9;i++) keyCodes['Digit'+i] = 29+i;
  keyCodes.Digit0 = 39;
  for(let i=1;i<=12;i++) keyCodes['F'+i] = 57+i;
  const keyNames = Object.fromEntries(Object.entries(keyCodes).map(([k,v])=>[v,k.replace(/^Key|^Digit/,'')]));
  function get(name) { const [offset,size,signed] = fields[name]; return size===1 ? view.getUint8(offset) : signed ? view.getInt16(offset,state.littleEndian) : view.getUint16(offset,state.littleEndian); }
  function set(name,value) { const [offset,size,signed] = fields[name]; if(size===1) view.setUint8(offset,value); else if(signed) view.setInt16(offset,value,state.littleEndian); else view.setUint16(offset,value,state.littleEndian); }
  function setProfile(values) { profile = Uint8Array.from(values); view = new DataView(profile.buffer); }
  function deviceFor(role) {
    const [guid,type,ordinal] = roleFields[role], offset=fields[guid][0];
    const wanted = Array.from(profile.slice(offset,offset+16));
    const matches=state.devices.filter(d=>d.type===get(type) && (wanted.every(v=>v===0) || d.guid.every((v,i)=>v===wanted[i])));
    return matches.filter(d=>d.ordinal===get(ordinal))[0] || null;
  }
  function sameRole(a,b) {
    const x=roleFields[a], y=roleFields[b];
    return get(x[1])===get(y[1]) && get(x[2])===get(y[2]) && profile.slice(fields[x[0]][0],fields[x[0]][0]+16).every((v,i)=>v===profile[fields[y[0]][0]+i]);
  }
  function error(message='') { $('error').textContent=message; }
  function stopLearning() {
    if(learning?.button) { learning.button.textContent='Learn'; learning.button.setAttribute('aria-pressed','false'); }
    learning=null; $('learning-panel').hidden=true; $('finish-learn').hidden=true;
  }
  function startLearning(value,button,message,axis=false) {
    stopLearning(); error(); learning={...value,button};
    button.textContent='Listening…'; button.setAttribute('aria-pressed','true');
    $('learn-status').textContent=message; $('learning-panel').hidden=false; $('finish-learn').hidden=!axis;
  }
  function releaseDuplicate(name,role,index,isAxis) {
    for(const [other,config] of Object.entries(isAxis?axes:buttons)) {
      if(other!==name && sameRole(role,config[1]) && get(other)===index) set(other,255);
    }
  }
  function bindButton(name,index) {
    releaseDuplicate(name,buttons[name][1],index,false); set(name,index);
    if(name==='throttle_button') set('throttle_axis',255);
    if(name==='brake_button') set('brake_axis',255);
    stopLearning(); render();
  }
  function learn(name,button) {
    stopLearning(); error();
    const config=axes[name]||buttons[name], device=deviceFor(config[1]);
    if(!device) return error('Connect and select the device first. Press a gamepad button if the browser has not exposed it yet.');
    startLearning({name,instance:device.instance,start:device.axes.slice(),low:device.axes.slice(),high:device.axes.slice(),directions:device.axes.map(()=>0)},button,
      axes[name] ? config[2]+' Choose Finish learning after the full sweep.' : 'Release held buttons, then press the button for '+config[0]+'.',!!axes[name]);
  }
  function finishAxis() {
    if(!learning || !axes[learning.name]) return;
    const {name,start,low,high,directions}=learning, config=axes[name];
    const spans=low.map((v,i)=>high[i]-v), span=Math.max(0,...spans), index=spans.indexOf(span);
    if(index<0 || span<8192) return error('Move the selected axis through its full range before finishing.');
    if(name==='steering_axis' && !(low[index]<start[index] && start[index]<high[index])) return error('Steering needs both sides of the centred position.');
    releaseDuplicate(name,config[1],index,true); set(name,index);
    if(name==='steering_axis') {
      set('steering_center',start[index]);
      set('steering_right',directions[index]>0?high[index]:low[index]);
      set('steering_left',directions[index]>0?low[index]:high[index]);
    } else {
      set(config[3],start[index]);
      set(config[4],Math.abs(high[index]-start[index])>Math.abs(low[index]-start[index])?high[index]:low[index]);
    }
    set('tuning_flags',get('tuning_flags') & ~({steering_axis:1,throttle_axis:2,brake_axis:4,clutch_axis:8}[name]));
    stopLearning(); error(); render();
  }
  function updateLearning() {
    if(!learning) return;
    const d=state.devices.find(d=>d.instance===learning.instance);
    if(!d) {stopLearning(); error('The device was disconnected. Reconnect it and start learning again.'); return;}
    if(axes[learning.name]) d.axes.forEach((v,i)=>{
      learning.low[i]=Math.min(learning.low[i],v); learning.high[i]=Math.max(learning.high[i],v);
      if(!learning.directions[i] && Math.abs(v-learning.start[i])>=8192) learning.directions[i]=Math.sign(v-learning.start[i]);
    });
    else {
      const previous=lastButtons.get(d.instance)||[];
      const index=d.buttons.findIndex((v,i)=>v && !previous[i]);
      if(index>=0) bindButton(learning.name,index);
    }
  }
  function row(parent,label,value,action,clear) {
    const div=document.createElement('div'); div.className='row';
    const title=document.createElement('span'); title.textContent=label; div.append(title);
    const group=document.createElement('span'), output=document.createElement('output'); output.textContent=value+' '; group.append(output);
    const button=document.createElement('button'); button.textContent='Learn'; button.className='learn'; button.setAttribute('aria-pressed','false'); button.onclick=()=>action(button); group.append(button);
    if(clear){const remove=document.createElement('button');remove.textContent='Clear';remove.setAttribute('aria-label','Clear '+label);remove.onclick=()=>{stopLearning();clear();};group.append(remove);}
    div.append(group); $(parent).append(div);
  }
  function renderDevices() {
    for(const role of Object.keys(roleFields)) {
      const select=$(role+'-device'), selected=deviceFor(role);
      select.replaceChildren(new Option('Automatic standard gamepad','auto'));
      for(const d of state.devices) select.add(new Option(d.name+(d.type?' — raw device':' — SDL gamepad'),String(d.instance)));
      const wanted=roleFields[role], any=profile.slice(fields[wanted[0]][0],fields[wanted[0]][0]+16).some(v=>v);
      if(any && !selected){select.add(new Option('Saved device (disconnected)','missing'));select.value='missing';}
      else select.value=any && selected ? String(selected.instance) : 'auto';
      select.onchange=()=>{
        stopLearning(); const d=state.devices.find(d=>String(d.instance)===select.value);
        const defaults=Uint8Array.from(state.defaults), offset=fields[wanted[0]][0];
        profile.set(d?d.guid:new Uint8Array(16),offset); set(wanted[1],d?d.type:0);set(wanted[2],d?d.ordinal:0);
        for(const [name,c] of Object.entries(axes)) if(c[1]===role) set(name,d&&d.type?255:defaults[fields[name][0]]);
        for(const [name,c] of Object.entries(buttons)) if(c[1]===role) set(name,d&&d.type?255:defaults[fields[name][0]]);
        const resetEndpoints=role==='steering'?['steering_left','steering_center','steering_right']:role==='pedal'?['throttle_released','throttle_pressed','brake_released','brake_pressed','clutch_released','clutch_pressed']:[];
        const defaultView=new DataView(defaults.buffer);
        for(const name of resetEndpoints) set(name,defaultView.getInt16(fields[name][0],state.littleEndian));
        if(role==='steering') set('tuning_flags',get('tuning_flags') & ~1);
        if(role==='pedal') set('tuning_flags',get('tuning_flags') & ~14);
        if(role==='steering') {set('steering_gamma_cent',d&&d.type?100:200);set('steering_deadzone_permille',d&&d.type?0:80);}
        error();render();
      };
    }
    $('devices').replaceChildren(...state.devices.map(d=>{
      const item=document.createElement('li');
      item.textContent=d.name+' — '+(d.type?'raw device':'SDL gamepad')+', '+d.axes.length+' axes, '+d.buttons.length+' buttons';
      return item;
    }));
  }
  function render() {
    renderDevices();
    for(const role of Object.keys(roleFields)) $(role+'-bindings').replaceChildren();
    for(const [name,c] of Object.entries(axes)) row(c[1]+'-bindings',c[0],get(name)===255?'Unassigned':'Axis '+(get(name)+1),button=>learn(name,button),name==='clutch_axis'?()=>{set(name,255);render();}:null);
    for(const [name,c] of Object.entries(buttons)) row(c[1]+'-bindings',c[0],get(name)===255?'Unassigned':'Button '+(get(name)+1),button=>learn(name,button),()=>{set(name,255);render();});
    $('assist-options').replaceChildren();
    for(const [label,bit] of [['Automatic gears (modern assist)',128],['Auto clutch',16],['Steering assist (CAS)',32],['Gamepad response curve',64]]) {
      const element=document.createElement('label');element.textContent=label;
      const input=document.createElement('input');input.type='checkbox';input.checked=!!(get('tuning_flags')&bit);input.onchange=()=>set('tuning_flags',get('tuning_flags')^bit);element.append(input);$('assist-options').append(element);
    }
    $('keyboard-bindings').replaceChildren();
    keyboard.forEach((label,i)=>{const offset=fields.keys[0]+2*i, code=view.getUint16(offset,state.littleEndian);row('keyboard-bindings',label,keyNames[code]||'Scancode '+code,button=>startLearning({key:i},button,'Press the new key for '+label+'. Escape cancels learning.'));});
    $('response-options').replaceChildren();
    const responseFields = {
      steering_deadzone_permille:['Steering deadzone (%)',0,500,10],
      steering_saturation_permille:['Steering saturation (%)',500,1000,10],
      steering_gamma_cent:['Steering response gamma',50,300,100],
      steering_sensitivity_permille:['Steering sensitivity (%)',100,2000,10],
      maximum_steering_permille:['Maximum steering (%)',100,1000,10],
      throttle_deadzone_permille:['Throttle deadzone (%)',0,500,10],
      brake_deadzone_permille:['Brake deadzone (%)',0,500,10],
      clutch_deadzone_permille:['Clutch deadzone (%)',0,500,10],
      steering_left:['Left steering lock',-32768,32767,1],
      steering_center:['Steering centre',-32768,32767,1],
      steering_right:['Right steering lock',-32768,32767,1],
      throttle_released:['Throttle released',-32768,32767,1],
      throttle_pressed:['Throttle pressed',-32768,32767,1],
      brake_released:['Brake released',-32768,32767,1],
      brake_pressed:['Brake pressed',-32768,32767,1],
      clutch_released:['Clutch released',-32768,32767,1],
      clutch_pressed:['Clutch pressed',-32768,32767,1]
    };
    for(const [name,[text,minimum,maximum,scale]] of Object.entries(responseFields)) {
      const label=document.createElement('label');label.textContent=text;
      const input=document.createElement('input');input.type='number';input.min=minimum/scale;input.max=maximum/scale;input.step=1/scale;input.value=get(name)/scale;
      input.onchange=()=>{const value=Math.round(Number(input.value)*scale);if(!Number.isFinite(value)||value<minimum||value>maximum){error('Value outside the displayed range.');input.value=get(name)/scale;}else{set(name,value);error();}};label.append(input);$('response-options').append(label);
    }
  }
  async function post(path,body='') {
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'text/plain'},body});
    const message=await response.text(); if(!response.ok) throw new Error(message); return message;
  }
  async function apply() {
    if(busy)return;stopLearning();error();
    if(get('steering_axis')===255) return error('Learn a steering axis first.');
    for(const name of ['throttle','brake']) if(get(name+'_axis')===255&&get(name+'_button')===255) return error('Learn a '+name+' axis or button first.');
    const hex=Array.from(profile,b=>b.toString(16).padStart(2,'0')).join('');
    busy=true;$('apply').disabled=true;
    try {
      if(embedded){session().pending=hex;session().error='';await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(session().done){clearInterval(timer);resolve();}else if(session().error){clearInterval(timer);reject(new Error(session().error));}},30);});}
      else await post('/apply',hex);
      finished=true;$('connection').textContent='Controls saved. Return to Revs.';$('editor').hidden=true;
    } catch(e){error(e.message);}finally{busy=false;$('apply').disabled=finished;}
  }
  async function cancel() { if(busy||finished)return;stopLearning();try{if(embedded)session().cancelled=true;else await post('/cancel');finished=true;$('editor').hidden=true;$('connection').textContent='Changes cancelled. Return to Revs.';}catch(e){error(e.message);} }
  async function poll() {
    clearTimeout(pollTimer);
    if(finished)return;
    if(polling){pollAgain=true;return;}
    polling=true;
    try {
      const next=embedded?session().state:await (await fetch('/state',{cache:'no-store'})).json();
      if(!state){state=next;fields=state.fields;setProfile(state.profile);render();$('editor').hidden=false;$('apply').disabled=false;$('reset').disabled=false;}
      state=next;
      const signature=JSON.stringify(state.devices.map(d=>[d.instance,d.name,d.type,d.axes.length,d.buttons.length]));
      if(signature!==deviceSignature){deviceSignature=signature;renderDevices();}
      $('connection').textContent=state.devices.length?state.devices.length+' device(s) connected':'No device exposed yet. Connect it and press a button.';
      if(learning && learning.key===undefined)updateLearning();
      for(const role of Object.keys(roleFields)){const d=deviceFor(role);$(role+'-live').textContent=d?'Axes: '+d.axes.map((v,i)=>(i+1)+': '+v).join('  ')+'\nPressed buttons: '+d.buttons.map((v,i)=>v?i+1:null).filter(v=>v!==null).join(', '):'Device not connected';}
      lastButtons=new Map(state.devices.map(d=>[d.instance,d.buttons.slice()]));
    }catch(e){error('Cannot read controls: '+e.message);}
    polling=false;
    if(!finished)pollTimer=setTimeout(poll,pollAgain?0:50);
    pollAgain=false;
  }
  document.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(learning && learning.key!==undefined){event.preventDefault();if(event.code==='Escape'){stopLearning();return;}const code=keyCodes[event.code];if(!code){error('That key is not supported. Choose a letter, number, function or navigation key.');return;}const offset=fields.keys[0]+2*learning.key;for(let i=0;i<keyboard.length;i++)if(fields.keys[0]+2*i!==offset&&view.getUint16(fields.keys[0]+2*i,state.littleEndian)===code){error('That key already has an action.');return;}view.setUint16(offset,code,state.littleEndian);stopLearning();error();render();}
    else if(event.code==='Escape'){event.preventDefault();if(learning)stopLearning();else cancel();}
  });
  $('finish-learn').onclick=finishAxis;$('apply').onclick=apply;$('cancel').onclick=cancel;
  $('close').onclick=cancel;
  $('cancel-learn').onclick=()=>{stopLearning();error();};
  $('detect').onclick=poll;
  for(const type of ['gamepadconnected','gamepaddisconnected']) deviceEvents.addEventListener(type,poll);
  window.addEventListener('focus',poll);
  $('reset').onclick=()=>{stopLearning();setProfile(state.defaults);error();render();};
  window.addEventListener('pagehide',()=>{
    clearTimeout(pollTimer);
    for(const type of ['gamepadconnected','gamepaddisconnected']) deviceEvents.removeEventListener(type,poll);
    if(!finished){if(embedded)session().cancelled=true;else navigator.sendBeacon('/cancel','');}
  });
  // Export only the codec helpers needed by the deterministic JS regression.
  window.RevsControlsEditor={keyCodes,axes,buttons};
  poll();
})();
