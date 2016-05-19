import Ember from 'ember';

export default Ember.Mixin.create({
  
  serializeRelationship(snapshot, data, rel) {
    
    const kind = rel.kind;
    
    snapshot.eachRelationship(relationship => {
      
      if (this.get(`attrs.${relationship}.serialize`) === true) {

        data.relationships = data.relationships || {};
        data.relationships[relationship] = data.relationships[relationship] || {};
        
        if (kind === "belongsTo") {
          data.relationships[relationship].data = this.serializeRecord(snapshot.belongsTo(relationship));
        }
        
        if (kind === "hasMany") {
          data.relationships[relationship].data = snapshot.hasMany(relationship).map(this.serializeRecord);
        }
        
      }

    });

  },
  
  serializeRecord(obj) {
    
    const serialized = obj.serialize();

    if (obj.id) {
      serialized.data.id = obj.id;
    } else {
      serialized.data.attributes.__id__ = obj.record.get('_internalModel')[Ember.GUID_KEY];
    }
    
    // do not allow embedded relationships
    delete serialized.data.relationships;
  
    return serialized.data;
  
  },
  
  serializeHasMany() {
    this._super(...arguments);
    this.serializeRelationship(...arguments);
  },
  
  serializeBelongsTo() {
    this._super(...arguments);
    this.serializeRelationship(...arguments);
  },
  
  updateRecord(json, store) {
    
    const record = store.peekAll(json.type)
      .filterBy('currentState.stateName', "root.loaded.created.uncommitted")
      .findBy('_internalModel.' + Ember.GUID_KEY, json.attributes.__id__);

    if (record) {
      record.unloadRecord();
    }

    store.push({ data: json });
    
    delete json.attributes;
    delete json.relationships;
    return json;

  },

  normalizeSaveResponse(store, modelName, obj) {
    
    const rels = obj.data.relationships || [];
    
    Object.keys(rels).forEach(rel => {
      if (Array.isArray(rels[rel].data)) {
        // hasMany
        rels[rel].data = rels[rel].data.map(json => this.updateRecord(json, store));
      } else {
        // belongsTo
        rels[rel].data.relationships = {
          albums: [{
            data: { id: obj.data.id, type: obj.data.type }
          }]
        };
        
        rels[rel].data = this.updateRecord(rels[rel].data, store);
      }
      
    });

    return this._super(store, modelName, obj);

  }

});