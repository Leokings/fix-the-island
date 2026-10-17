import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';

// Lossless generated catalog data only. No rule, ABI, prompt, or artifact
// changes. Uses literal runs and bounded backreferences, not a compression
// library in GenVM. Base64 is only the ASCII transport for these bytes.
const root=new URL('../',import.meta.url);
const sourcePath=new URL('contracts/island_repairs.source.py',root);
const source=await readFile(sourcePath,'utf8');
const catalog=Buffer.from(JSON.stringify(JSON.parse(await readFile(new URL('contracts/island_fixtures.json',root),'utf8'))));
function pack(input){
  const output=[],positions=new Map();let literals=[];
  const flush=()=>{if(literals.length){output.push(literals.length-1,...literals);literals=[];}};
  const key=i=>(input[i]<<16)|(input[i+1]<<8)|input[i+2];
  const remember=i=>{if(i+2>=input.length)return;const k=key(i),list=positions.get(k)??[];list.push(i);if(list.length>96)list.shift();positions.set(k,list);};
  for(let i=0;i<input.length;){
    let length=0,offset=0;
    for(const previous of (i+2<input.length?positions.get(key(i))??[]:[]).toReversed()){
      const distance=i-previous;if(distance>65535)break;
      let n=0;while(n<131&&i+n<input.length&&input[previous+n]===input[i+n])n++;
      if(n>length){length=n;offset=distance;}
      if(length===131)break;
    }
    if(length>=4){flush();output.push(128+length-4,offset>>8,offset&255);for(let n=0;n<length;n++)remember(i+n);i+=length;}
    else{literals.push(input[i]);remember(i++);if(literals.length===128)flush();}
  }
  flush();return Buffer.from(output);
}
function unpack(input){
  const out=[];
  for(let i=0;i<input.length;){const tag=input[i++];if(tag<128){out.push(...input.subarray(i,i+tag+1));i+=tag+1;}else{const offset=(input[i++]<<8)|input[i++];assert(offset>0&&offset<=out.length);for(let n=0;n<(tag&127)+4;n++)out.push(out[out.length-offset]);}}
  return Buffer.from(out);
}
const encoded=pack(catalog);assert.deepEqual(unpack(encoded),catalog);
const block=`# BEGIN GENERATED CATALOG: tools/pack-genlayer-catalog.mjs
# Literal run: tag + 1 bytes. Backreference: (tag & 127) + 4 bytes,
# copied from the preceding unsigned 16-bit distance. Exact manifest bytes.
_PACKED_CATALOG = '${encoded.toString('base64')}'


def _catalog_text():
    data = base64.b64decode(_PACKED_CATALOG)
    output = bytearray()
    cursor = 0
    while cursor < len(data):
        tag = data[cursor]
        cursor += 1
        if tag < 128:
            output.extend(data[cursor:cursor + tag + 1])
            cursor += tag + 1
        else:
            offset = data[cursor] * 256 + data[cursor + 1]
            cursor += 2
            for _ in range((tag & 127) + 4):
                output.append(output[-offset])
    return output.decode('utf-8')


_CATALOG_JSON = _catalog_text()
# END GENERATED CATALOG`;
const region=source.includes('# BEGIN GENERATED CATALOG:')?/# BEGIN GENERATED CATALOG:[\s\S]*?# END GENERATED CATALOG/:/_CATALOG_JSON = r?'''[\s\S]*?'''/;
assert(region.test(source),'Catalog source marker is required');
let generated=source.replace(region,block);
if(!/^import base64$/m.test(generated))generated=generated.replace('import hashlib','import base64\nimport hashlib');
console.log(JSON.stringify({catalogBytes:catalog.length,packedBytes:encoded.length,sourceBytes:Buffer.byteLength(generated)}));
if(process.argv.includes('--write')){
  // Generated-data rewrite; the source body outside the catalog is retained.
  await writeFile(sourcePath,generated);
}else if(!process.argv.includes('--measure')){
  assert.equal(source.replaceAll('\r\n','\n'),generated.replaceAll('\r\n','\n'),'Regenerate catalog with --write');
}
