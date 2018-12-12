//objet.watch
//if (!Object.prototype.watch)
  Object.prototype.watch = function (prop, handler) {
    var _self = this, oldval = this[prop], newval = oldval;

    if (typeof _self.__h === 'undefined')
      Object.defineProperty(_self, "__h", {value: {},enumerable: false});

    if (typeof _self.__h[prop] === 'undefined')
      _self.__h[prop] = handler;
    else {
      var lasth = _self.__h[prop];
      _self.__h[prop] = function(prop, oldVal, newVal) {
        return handler(prop, oldVal,
            lasth(prop, oldVal, newVal));
      };
    }

    var getter = function () {
      return newval;
    },
    setter = function (val) {
      oldval = newval;
      if (oldval === val) return val;
      return newval = _self.__h[prop](prop, oldval, val);
    };
    if (delete this[prop]) {
      if (Object.defineProperty)
        Object.defineProperty(this, prop, {
          get: getter,
          set: setter,
          enumerable: true
        });
      else if (Object.prototype.__defineGetter__ &&
          Object.prototype.__defineSetter__) {
        Object.prototype.__defineGetter__.call(this, prop, getter);
        Object.prototype.__defineSetter__.call(this, prop, setter);
      }
    }
  };
Object.defineProperty(Object.prototype, "watch", {enumerable: false});
// object.unwatch
//if (!Object.prototype.unwatch)
  Object.prototype.unwatch = function (prop) {
    var val = this[prop];
    delete this.__h[prop];
    delete this[prop];
    this[prop] = val;
  };
Object.defineProperty(Object.prototype, "unwatch", {enumerable: false});

// querySelector
var $ = function(selector, node) {
  if (selector[0]==="#")
    return (node? node : document).querySelector(selector);
  else{
    var ret = (node? node : document).querySelectorAll(selector);
    return (ret.length === 1)? ret[0] : ret;
  }
};


Array.prototype.indexOfByProp = function (value, prop){
  var index;
  for (index = 0; index < this.length; index ++)
    if(this[index][prop] === value) return index;
  return -1;
};

Array.prototype.diff = function(a, prop){
  return (prop)
    ? this.filter(function(it){return a.filter(function(ai){return it[prop] === ai[prop];}) <= 0;})
    : this.filter(function(it){return a.filter(function(ai){return it === ai;}) <= 0;});
};

///////////////////////////////////////////////////////////////////////////////
////////////////////////// DATA LINK Object ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

var DataLink = function(){

  this.models = {};
  this.directives = {};

  this.makeDefaultDirectives();

};

DataLink.prototype.makeNewDirective = function(name, apply, level, type){

  if(typeof this.directives[name] !== 'undefined')
    return false;

  this.directives[name] = {
    name: name,
    level: level || 10,
    type: type || name,
    apply: apply
  };
  return true;
};

// Get Node Properties
DataLink.prototype.gnps = function(node, directive){
  var attr, prop = {};

  for(i=0; i<node.attributes.length; i++){
    attr = node.attributes[i];
    if (attr.name[0]==='~')
      if(attr.value ==="" || attr.name === attr.value){
        if(attr.name.indexOf(':')>0){
          let attrspl = attr.split(':');
          prop[attrspl[0]] = attrspl.slice(1).join(':');
        }else
          prop['~'] = attr.name.slice(1);
      }else
        prop[attr.name.slice(1)] = attr.value;
  }

  if (directive.mode==='a'){
     if(typeof prop['~'] === 'undefined') prop['~~'] = prop['~'];
     prop['~'] = node.getAttribute('*' + directive.name);
     if(typeof prop['~~'] !== 'undefined' && typeof prop['~'] === 'undefined')
       prop['~'] = prop['~~'];
  }

  return prop;
};

DataLink.prototype.makeDefaultDirectives = function(){
  var gsp = this.gsp.bind(this);
  var gnps =  this.gnps.bind(this);

  // Model
  this.makeNewDirective('model', function(node, prop, model) {
  // model="ref"
    var prop = prop['~'];
    if (typeof gsp(prop) === 'undefined')
      gsp(prop, null ,{});

    return {recursive: true, model: gsp(prop)};

  }, -1, 'model.set');

  //onclick pathfunction
  this.makeNewDirective('onclick', function(node, prop, model){
    var prop = prop['~'].split('(');

    node.onclick = function(e){
      if (!node.disabled){

        return (prop.length>1)
          ? gsp(prop[0],model, [e, prop[1].split(')')[0]])//.split(',').replace(/\s/g, ' '))
          : gsp(prop[0], model, [e]);
      }
    };
    return {recursive: true, model: model};
  }, 8, 'event.onclick');
  //sattr
  this.makeNewDirective('sattr', function(node, prop, model) {
  // sattr="porpname:ref"

    var prop = prop['~'].split(':');
    let attrname = prop[0];
    prop = prop[1];

    var submodel = model;

    /*if (typeof  gsp(prop, submodel) === 'undefined' || node.getAttribute(attrname))
       gsp(prop, submodel, node.getAttribute(attrname));
    else */
    if (typeof gsp(prop, submodel) === 'string')
      node.setAttribute(attrname, gsp(prop, submodel));
    else
      node.setAttribute(attrname, gsp(prop, submodel));

    var watcher = function(submodel, prop) {
      submodel.watch(prop, function(prop, oldVal, newVal) {
        node.setAttribute(attrname, newVal);
        return newVal;
      });
    };

    if (prop[0]==='#'){
      submodel = gsp(prop.split('.').slice(0,-1).join('.'));
      prop = prop.split('.').slice(-1)[0];
    }else if(prop.indexOf('.')>0){
      let steps = prop.split('.');
      for(let i=0; i<steps.length-1;i++)
        submodel= submodel[steps[i]];
      prop = steps.slice(-1)[0];
    }
    watcher(submodel, prop);

    return {recursive: true, model: model};
  }, 5, 'content.link');
  //Bring
  this.makeNewDirective('bring', function(node, prop, model) {
  // bring="ref"

    var prop = prop['~'];
    var submodel = model;

    /*
    /getif (typeof  gsp(prop, submodel) === 'undefined' || node.innerHTML.length>0)
      gsp(prop, submodel, node.innerHTML);
    else
    */
    if (typeof gsp(prop, submodel) === 'string')
      node.innerHTML = gsp(prop, submodel);
    else
      node.innerHTML = JSON.stringify(gsp(prop, submodel));

    var watcher = function(submodel, prop) {
      submodel.watch(prop, function(prop, oldVal, newVal) {
        node.innerHTML = (typeof newVal !== 'string' ) ?
          JSON.stringify(newVal) : newVal;
        return newVal;
      });
    };

    if (prop[0]==='#'){
      submodel = gsp(prop.split('.').slice(0,-1).join('.'));
      prop = prop.split('.').slice(-1)[0];
    }else if(prop.indexOf('.')>0){
      let steps = prop.split('.');
      for(let i=0; i<steps.length-1;i++)
        submodel= submodel[steps[i]];
      prop = steps.slice(-1)[0];
    }
    watcher(submodel, prop);

    return {recursive: true, model: model};
  }, 4, 'content.link');

  //DLink
  this.makeNewDirective('dlink', function(node, prop, model) {
  // dlink="ref"

    var prop = prop['~'];

    var _self = this;
    if (typeof gsp(prop, model) === 'undefined')
      gsp(prop, model, "");
    var change = function() {
      gsp(prop, model, p());
    };
    var p = function(v){
      switch(node.nodeName.toLowerCase()) {
        case "textarea":
          if (node.innerHTML === v) return v;
          if (typeof v !== 'undefined') node.innerHTML = v;
          return node.innerHTML;
          break;
        case "select":

          var selecteds = [];
          var options = node.getElementsByTagName('option');

          for (var i=0; i < options.length; i++)
            if (options[i].selected)
              selecteds.push(options[i].value);

          if (typeof v !== 'undefined') {
            if (JSON.stringify(_self.clearModel(selecteds)).slice(1,-1) ===
                JSON.stringify(_self.clearModel(v)).slice(1,-1))
              return v;

            for (var i=0; i < options.length; i++)
              options[i].selected = false;

            for (var j=0; j<v.length; j++)
              for (var i=0; i < options.length; i++)
                if (v[j] === options[i].value) {
                  options[i].selected = true;
                  continue;
                }
            return v;
          }else
            return selecteds;
          break;
        case "input":
          switch(node.attributes.type.value) {

            case "radio":
              var radiochecked =$(
                  'input[type="radio"][name="' +
                  node.attributes.name.value + '"]:checked'
                  );
              if (radiochecked.value === v) return v;
              if (typeof v !== 'undefined'){
                radiochecked.checked = false;
                radiochecked = $('input[type="radio"][value="'+v+'"]');
                radiochecked.checked = true;
              }
              return radiochecked.value;
              break;

            case "checkbox":
              if (node.checked === v) return  v;
              if (typeof v !== 'undefined') node.checked = v;
              return node.checked;

            case "text":
            case "pasword":
            default:
              if (node.value === v) return v;
              if (typeof v !== 'undefined') node.value = v;
              return node.value;
          }
        default:
      }
    };

    if (node.attributes.type) if(node.attributes.type.value === "radio"){
      var radios = $('input[name="'+node.attributes.name.value+'"][type="radio"]');
      for(var i = 0; i < radios.length; i++)
        radios[i].onchange = change;
    }
    var tmpVal = p();
    if (typeof tmpVal !== "undefined" && tmpVal!=='')
      gsp(prop, model, tmpVal);
    else
      p(gsp(prop, model));

    if (node.addEventListener)
      node.addEventListener('DOMAttrModified', change, false);
    else if (node.attachEvent)
      node.attachEvent('onpropertychange', change);
    node.onchange = change;
    node.onclick = change;
    node.onkeypress = change;
    node.onkeydown = function() {
      setTimeout(change, 100);
    }
    node.onkeyup = node.onblur = change;

    var watcher = function(model, prop) {
      model.watch(prop, function(prop, oldval, newval) {
        return p(newval);
      });
    };

    if (prop[0]==='#'){
      model = gsp(prop.split('.').slice(0,-1).join('.'));
      prop = prop.split('.').slice(-1)[0];
    }else if(prop.indexOf('.')>0){
      let steps = prop.split('.');
      for(let i=0; i<steps.length-1;i++)
        model= model[steps[i]];
      prop = steps.slice(-1)[0];
    }
    watcher(model, prop);

    return {recursive: true, model: model};
  }, 5, 'content.link');

  //For
  this.makeNewDirective('dlfor', function(node, prop, model) {
  // for="ref"
    var prop = prop['~'];
    var range = [], doom, _self = this;
    var lastmodel = model;
    doom = node.innerHTML;
    if (typeof gsp(prop, model) === 'undefined')
      gsp(prop, model, {});

    const getIterator = () =>  {
      let iterator;
      const ename = 'iteration';
      console.log(node.atributes);
      const custom = (node.attributes[':item'])
        ? node.attributes[':item'].value
        : ((node.attributes[':']) ? node.attributes[':'] : undefined) ;

      if (custom) {
        const cspl = custom.split('{');
        iterator = document.createElement(cspl[0] || ename);
        if (custom.indexOf("{") >-1) {
          const attr = JSON.parse("{" + cspl[1]);
          for (a in attr) iterator.setAttribute(a , attr[a]);
        }
      }else
        iterator = document.createElement(ename);

      return iterator;
    };


    var p = function(v){
      node.innerHTML = "";
      range = [];
      // genero un rango por defecto
      // mas adelante abra un atributo para mejorar esto.
      for (var i=0; i < v.length; i++)
        range.push(i);

      for (var i, j=0; j < range.length;j++) {
        i = range[j];

        //var iteration = document.createElement('iteration');
        var iteration = getIterator();
        iteration.innerHTML = doom;

        if (typeof v[i] === 'undefined')
          v[i] = {index: i};
        else
          v[i].index = i;
        node.appendChild(iteration);
        _self.linker(iteration, v[i]);
      }

    };

    var watcher = function(model, prop) {
      model.watch(prop, function(prop, oldVal, newVal){
        if ( JSON.stringify(_self.clearModel(gsp(prop, model)))
            !== JSON.stringify(_self.clearModel(newVal))) {
          p(newVal);
        }
        return newVal;
      });
    };

    p(gsp(prop, model));

    if (prop[0]==='#'){
      model = gsp(prop.split('.').slice(0,-1).join('.'));
      prop = prop.split('.').slice(-1)[0];
    }else if(prop.indexOf('.')>0){
      let steps = prop.split('.');
      for(let i=0; i<steps.length-1;i++)
        model= model[steps[i]];
      prop = steps.slice(-1)[0];
    }
    watcher(model, prop);

    return {recursive: false, model:lastmodel};
  }, 5 , 'content.link');

  // cls
  this.makeNewDirective('cls', function(node, prop, model) {
  // cls="-clss,clss,clss:ref;clss,-clss,clss:ortherref"

    var clss = [], sprop, listOfCls = prop['~'].split(';');

    var p = function(clss, newVal){

      var sign = clss[0]!=='-';
      if (!sign) clss=clss.slice(1);

      if ( sign === (true === newVal))
        node.classList.add(clss);
      else
        node.classList.remove(clss);
    };

    var watcher = function(model, lclss, clss){
      model.watch(lclss, function(prop, oldVal, newVal) {
        p(clss, newVal);
        return newVal;
      });
    };

    for (var i = 0; i < listOfCls.length; i++) {
      listOfCls[i] = listOfCls[i].split(':');
      clss = listOfCls[i][0].split(',');

      if (typeof gsp(listOfCls[i][1], model) ==='undefined')
        gsp(listOfCls[i][1], model, false);

      for (var j = 0; j < clss.length; j++) {
        p(clss[j], gsp(listOfCls[i][1], model));

        if (listOfCls[i][1][0]==='#'){
          model = gsp(listOfCls[i][1].split('.').slice(0,-1).join('.'));
          sprop = listOfCls[i][1].split('.').slice(-1)[0];
        }else if (listOfCls[i][1].indexOf('.')>-1){
          let steps = listOfCls[i][1].split('.');
          for(let w=0; w<steps.length-1; w++)
            model = model[steps[w]];
          prop = steps.slice(-1)[0];
        }else
          sprop = listOfCls[i][1];
        watcher(model, sprop, clss[j]);
      }
    }
    return {recursive: true, model: model};
  }, 2, 'property.class');
};

// getter setter prop
DataLink.prototype.gsp = function(prop, model, val){

  if (Array.isArray(prop))
    prop = prop[0];

  var route, steps, last;
  if (prop[0]==="#") {
    route = this.models;
    steps = prop.slice(1);
  } else {
    if (typeof model !== 'undefined' && model !== null)
      route = model;
    else
      route = this.models;
    steps = prop;
  }

  steps = steps.split('.');
  last = steps.slice(-1);

  for (var i=0; i<steps.length-1; i++){
    route = route[steps[i]];
  }

  if (typeof route[last] === 'function') {
    if (typeof val !== 'undefined')
      if (Array.isArray(val))
        return route[last].apply(model, val);
      else if(val != undefined)
        return route[last].apply(model, [val]);
    return route[last].apply(model);
  } else if (typeof val !== 'undefined')
    route[last] = val;

  return route[last];
};

DataLink.prototype.linker = function(node, model) {
  var directives = [], recursive = true, ret,  i;

  // si el elemento es una directiva
  if (typeof this.directives[node.nodeName.toLowerCase()] !== 'undefined')
    directives.push({name: node.nodeName.toLowerCase(), mode: 'e', level: this.directives[node.nodeName.toLowerCase()].level});

  //si alguna propiedad es una directiva (*)
  for(i=0; i<node.attributes.length; i++)
    if(node.attributes[i].name[0] === '*')
      directives.push({name: node.attributes[i].name.slice(1), mode: 'a', level: this.directives[node.attributes[i].name.slice(1)].level});

  // ordena las directivas segun el nivel
  directives = directives.sort( (a, b) => {
    return this.directives[a.name].level - this.directives[b.name].level;
  });

  // aplica las directivas para el nodo actual
  for(i=0; i<directives.length; i++){
    ret = this.directives[directives[i].name].apply.call(this, node, this.gnps(node, directives[i]), model);
    model = ret.model;
    recursive = recursive && ret.recursive;
  }

  // si no se pauso la recursividad
  if (recursive)
    for(i=0; i<node.children.length; i++)
      if (node.children[i].nodeName)
        this.linker(node.children[i], model);

};

DataLink.prototype.Model = function(name, model){
  if (typeof model !== 'object') model = {};
  if ( typeof this.models[name] === 'undefined')
    this.models[name] = model;
  return this.models[name];
};

DataLink.prototype.clearModel = function(model) {
  var i, clearModel={};
  if (typeof model !== 'object' && typeof model !== 'array')
    return model;
  for (i in model)
    clearModel[i] = this.clearModel(model[i]);
  return clearModel;
};
