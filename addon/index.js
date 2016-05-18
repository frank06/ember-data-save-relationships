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

  normalizeSaveResponse(store, modelName, obj) {
    
    const rels = obj.data.relationships || [];
    
    Object.keys(rels).forEach(rel => {
      
      rels[rel].data.forEach(elem => {
        const record = store.peekAll(elem.type)
          .filterBy('currentState.stateName', "root.loaded.created.uncommitted")
          .findBy('_internalModel.' + Ember.GUID_KEY, elem.attributes.__id__);

        if (record) {
          record.unloadRecord();
        }
        
        store.push({ data: elem });
        
      });
      
    });

    return this._super(...arguments);

  }

});