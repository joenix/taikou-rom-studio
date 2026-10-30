import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {RomDocument} from '../src/rom/document.js';
const file=process.argv[2];if(!file)throw Error('用法：npm run inspect -- <ROM 路径>');
try{const d=await RomDocument.load(await readFile(file),basename(file)),s=d.snapshot();console.log(JSON.stringify({filename:d.filename,sha256:d.sha256,bytes:d.byteLength,profile:d.validation.profile,counts:Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v.length])),checksumMatches:d.validation.checksumMatches},null,2));}
catch(error){console.error(JSON.stringify({code:error.code||'ERROR',message:error.message,details:error.details},null,2));process.exitCode=1;}
