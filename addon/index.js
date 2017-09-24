import Ember from 'ember';

export default Ember.Mixin.create({

  serializeRelationship(snapshot, data, rel) {
    const relKind = rel.kind;
    const relKey = rel.key;
    
    if (data && this.get(`attrs.${relKey}.serialize`) === true) {

      data.relationships = data.relationships || {};
      const key = this.keyForRelationship(relKey, relKind, 'serialize');
      data.relationships[key] = data.relationships[key] || {};
      
      if (relKind === "belongsTo") {
        data.relationships[key].data = this.serializeRecord(snapshot.belongsTo(relKey));
      }
      
      if (relKind === "hasMany" && typeof(snapshot.hasMany(relKey)) !== "undefined") {
        data.relationships[key].data = snapshot.hasMany(relKey).map(this.serializeRecord.bind(this));
      }
      
    }

  },
  
  serialize (snapshot, options) {
    if (!(options && options.__isSaveRelationshipsMixinCallback))
    {
      this.set("_visitedRecordIds", {});
    }
    return this._super(...arguments);
  },

  _visitedRecordIds: {},

  serializeRecord(obj) {
    if (!obj) {
      return null;
    }
    
    const serialized = obj.serialize({__isSaveRelationshipsMixinCallback: true});

    if (obj.id) {
      serialized.data.id = obj.id;
      this.get('_visitedRecordIds')[obj.id] = {};
    } else {
      if (!serialized.data.attributes)
      {
        serialized.data.attributes = {};
      }
      serialized.data.attributes.__id__ = obj.record.get('_internalModel')[Ember.GUID_KEY];
      this.get('_visitedRecordIds')[serialized.data.attributes.__id__] = {};
    }


    for (let relationshipId in serialized.data.relationships) {
      if (!!this.get('_visitedRecordIds')[relationshipId])
      {
        delete serialized.data.relationships[relationshipId];
      }
    }

    if (serialized.data.relationships === {})
    {
      delete serialized.data.relationships;
    }

    // // do not allow embedded relationships
    // delete serialized.data.relationships;
  
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
    if (json.attributes !== undefined && json.attributes.__id__ !== undefined)
    {
      json.type = Ember.String.singularize(json.type);
      
      const record = store.peekAll(json.type)
        .filterBy('currentState.stateName', "root.loaded.created.uncommitted")
        .findBy('_internalModel.' + Ember.GUID_KEY, json.attributes.__id__);

      if (record) {
        // record.unloadRecord();
        record.set('id', json.id);
        record._internalModel.flushChangedAttributes();
        record._internalModel.adapterWillCommit();
        store.didSaveRecord(record._internalModel);
        // store.push({ data: json });
      }

    }

    return json;

  },

  normalizeSaveResponse(store, modelName, obj) {
    const rels = obj.data.relationships || [];
    
    let included = {};
    if (obj.included)
    {
      included = obj.included.reduce((prev, current) => {
        prev[current.id] = current;
        return prev;
      }, {});
    }

    Object.keys(rels).forEach(rel => {
      let relationshipData = rels[rel].data;
      if (relationshipData)
      {
        this.normalizeRelationship(relationshipData, store, included);
      }
    });

    // now run through the included objects looking for client ids
    if (obj.included) {
      for(let includedItem of obj.included) {
        this.updateRecord(includedItem, store);
      }
    }

    return this._super(store, modelName, obj);
  },

  normalizeRelationship(relationshipData, store, included) {
    if (Array.isArray(relationshipData)) {
      // hasMany
      relationshipData = relationshipData.map(item => this.normalizeRelationshipItem(item, store, included));
    } else if (relationshipData) {
      this.normalizeRelationshipItem(relationshipData, store, included);
    }
  },

  normalizeRelationshipItem(item, store, included) {
    if (item.__normalized) { return; }
    item.__normalized = true;
    let includedData = included[item.id];
    if (includedData)
    {
      item = includedData;
    }
    let internalRelationships = item.relationships;
    if (internalRelationships !== undefined) {
      Object.keys(internalRelationships).forEach(rel => {
        this.normalizeRelationship(internalRelationships[rel].data, store, included);
      });
    }
    if (!includedData)
    {
      // if it's in the included block then it will be updated at the end of normalizeSaveResponse
      this.updateRecord(item, store);
    }
  }

});