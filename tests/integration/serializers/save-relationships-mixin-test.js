import Ember from 'ember';
import { module, test } from 'qunit';
import DS from 'ember-data';
import SaveRelationshipsMixin from 'ember-data-save-relationships';

var registry, store, Artist, Album;

module('serializers/save-relationships-mixin', {

  beforeEach() {
    
    registry = new Ember.Registry();

    const Owner = Ember.Object.extend(Ember._RegistryProxyMixin, Ember._ContainerProxyMixin);
    const owner = Owner.create({
      __registry__: registry
    });
    const container = registry.container({
      owner: owner
    });
    owner.__container__ = container;
    
    Artist = DS.Model.extend({
      name: DS.attr(),
      albums: DS.hasMany('album')
    });
    
    Album = DS.Model.extend({
      name: DS.attr(),
      artist: DS.belongsTo('artist')
    });
    
    registry.register('model:artist', Artist);
    registry.register('model:album', Album);
    
    registry.register('service:store', DS.Store.extend({ adapter: '-default' }));
        
    store = container.lookup('service:store');
    
    // store.modelFor('artist');
    // store.modelFor('album');
    
    registry.register('adapter:application', DS.JSONAPIAdapter);
    registry.register('serializer:application', DS.JSONAPISerializer);

    
  },
  
  afterEach() {
    Ember.run(store, 'destroy');
  }

});

test("normalizeResponse with embedded objects", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: false }
    }
  }));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { name: "Kid B" });
    const album3 = store.createRecord('album', { name: "Kid C" });

    artist.get('albums').pushObjects([album1, album2, album3]);
  
    assert.equal(artist.get('albums.length'), 3);
    
    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  const albumsJSON = { data: [
    { attributes: { name: 'Kid A', __id__: '1internal-model' },
      type: 'albums' },
    { attributes: { name: 'Kid B', __id__: '2internal-model' },
      type: 'albums' },
    { attributes: { name: 'Kid C', __id__: '3internal-model' },
    type: 'albums' } ]
  };
  
  assert.deepEqual(artistJSON, { data: {
      attributes: { name: 'Radiohead' },
      relationships: { albums: albumsJSON },
      type: 'artists'
    }
  });
  


});
