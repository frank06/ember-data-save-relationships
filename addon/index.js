import Ember from 'ember';

export default Ember.Mixin.create({
  
  serializeHasMany(snapshot, data, relationship) {
    
    this._super(snapshot, data, relationship);
    
    snapshot.eachRelationship(relationship => {
      
      if (this.get(`attrs.${relationship}.serialize`) === true) {
        
        const array = snapshot.record.get(relationship);

        data.relationships = data.relationships || {};
        data.relationships[relationship] = data.relationships[relationship] || {};
        data.relationships[relationship].data = array.map(obj => {
        
          const serialized = obj.serialize();

          if (obj.id) {
            serialized.data.id = obj.id;
          } else {
            serialized.data.attributes.__id__ = obj.get('_internalModel')[Ember.GUID_KEY];
          }
        
          return serialized.data;
        
        });
        
      }

    });

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