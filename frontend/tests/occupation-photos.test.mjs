import test from 'node:test';
import assert from 'node:assert/strict';
import {PHOTOS_BY_OCCUPATION,occupationPhotos} from '../src/lib/occupationPhotos.js';

test('ocupações com foto única têm fonte fornecida',()=>{
  for(const code of ['05','08','09','17','39','50','53']) assert.equal(PHOTOS_BY_OCCUPATION[code].length,1);
});
test('ocupação 54 mantém duas fotos no cartão',()=>{
  const people=[{id:'a',photo:''},{id:'b',photo:''}];
  const photos=occupationPhotos('54',people);
  assert.equal(photos.length,2);
  assert.notEqual(photos[0].src,photos[1].src);
});
test('foto cadastrada tem preferência sobre a foto de referência',()=>{
  const photos=occupationPhotos('17',[{id:'a',photo:'https://exemplo.com/foto.jpg'}]);
  assert.equal(photos[0].src,'https://exemplo.com/foto.jpg');
});
test('ocupação sem foto não gera imagem fictícia',()=>{
  assert.deepEqual(occupationPhotos('11',[]),[]);
});
