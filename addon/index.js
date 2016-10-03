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

      if (relKind === "hasMany") {
        data.relationships[key].data = snapshot.hasMany(relKey).map(this.serializeRecord);
      }

    }

  },

  serializeRecord(obj) {

    if (!obj) {
      return null;
    }

    const serialized = obj.serialize();

    if (obj.id) {
      serialized.data.id = obj.id;
    } else {
      if (!serialized.data.attributes)
      {
        serialized.data.attributes = {};
      }
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

    if (!json.attributes) {
      // return non-attribute (id/type only) JSON intact
      return json;
    }

    const record = store.peekAll(json.type)
      .filterBy('currentState.stateName', "root.loaded.created.uncommitted")
      .findBy('_internalModel.' + Ember.GUID_KEY, json.attributes.__id__);

    if (record) {
      record.set('id', json.id);
      record._internalModel.flushChangedAttributes();
      record._internalModel.adapterWillCommit();
      store.didSaveRecord(record._internalModel);
    }

    return json;

  },

  normalizeSaveResponse(store, modelName, obj) {

    const rels = obj.data.relationships || [];

    Object.keys(rels).forEach(rel => {

      // guard against potential `null` relationship, allowed by JSON API
      if (!rels[rel]) {
        return;
      }

      let relationshipData = rels[rel].data;
      if (Array.isArray(relationshipData)) {
        // hasMany
        relationshipData = relationshipData.map(json => {
          json.type = Ember.String.singularize(json.type);
          this.updateRecord(json, store);
        });
      } else {
        // belongsTo
        relationshipData.type = Ember.String.singularize(relationshipData.type);
        relationshipData = this.updateRecord(relationshipData, store);
      }

    });

    return this._super(store, modelName, obj);

  }

});