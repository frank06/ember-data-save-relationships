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
    
    registry.register('adapter:application', DS.JSONAPIAdapter);
    registry.register('serializer:application', DS.JSONAPISerializer);
    
  },
  
  afterEach() {
    Ember.run(store, 'destroy');
  }

});

test("serialize artist with embedded albums (with ID)", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

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

test("serialize artist without embedded albums", function(assert) {

  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: false }
    }
  }));

  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;

  Ember.run(function() {

    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { name: "Kid B" });
    const album3 = store.createRecord('album', { name: "Kid C" });

    artist.get('albums').pushObjects([album1, album2, album3]);

    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  assert.deepEqual(artistJSON, { data: {
      attributes: { name: 'Radiohead' }, type: 'artists'
    }
  });

});


test("serialize artist with embedded albums (with and without ID)", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { id: 1, name: "Kid A" });
    const album4 = store.createRecord('album', { name: "Kid D" });
    artist.get('albums').pushObjects([album1, album4]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());

  });
  
  // __id__ should not be present in album with id
  assert.equal(artistJSON.data.relationships.albums.data[0].attributes.__id__, undefined);
  
  // __id__ should be present in album without id
  assert.ok(artistJSON.data.relationships.albums.data[1].attributes.__id__);

});

test("serialize album with embedded belongs-to artist (without ID)", function(assert) {
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      artist: { serialize: true }
    }
  }));
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("album");
  let albumJSON;
  
  Ember.run(function() {
    
    const album = store.createRecord('album', { name: "Kid A" });
    const artist = store.createRecord('artist', { name: "Radiohead" });
    album.set('artist', artist);
  
    albumJSON = serializer.serialize(album._createSnapshot());

  });
  
  assert.equal(albumJSON.data.relationships.artist.data.attributes.name, "Radiohead");

});

test("normalize artist + album", function(assert) {
  
  registry.register('serializer:artist', DS.JSONAPISerializer.extend(SaveRelationshipsMixin, {
    attrs: {
      albums: { serialize: true }
    }
  }));
  
  registry.register('serializer:album', DS.JSONAPISerializer.extend(SaveRelationshipsMixin));

  const serializer = store.serializerFor("artist");
  let artistJSON;
  
  Ember.run(function() {
    
    const artist = store.createRecord('artist', { name: "Radiohead" });
    const album1 = store.createRecord('album', { name: "Kid A" });
    const album2 = store.createRecord('album', { id: "2", name: "Kid B" });
    artist.get('albums').pushObjects([album1, album2]);
  
    artistJSON = serializer.serialize(artist._createSnapshot());
    
    const internalId = artistJSON.data.relationships.albums.data[0].attributes.__id__;
    
    const serverJSON = { data: 
     { id: "1",
       attributes: { name: 'Radiohead' },
       relationships: { albums: { data: 
     [ { id: "89329", attributes: { name: "Kid A", __id__: internalId }, type: 'album' },
       { id: "2", attributes: { name: "Kid B2" }, type: 'album' } ] } },
       type: 'artist' } };
    
    serializer.normalizeResponse(store, Artist, serverJSON, '1', 'createRecord');

  });
  
  // first album should be in a saved state and have an id
  const firstAlbum = store.peekAll('album').findBy("name", "Kid A");
  assert.equal(firstAlbum.get('currentState.stateName'), "root.loaded.saved");
  assert.equal(firstAlbum.get('id'), "89329");
  
  // second album should have updated name -- TODO check should be B2???
  const secondAlbum = store.peekAll('album').objectAt(0);
  assert.equal(secondAlbum.get('name'), "Kid B");

});