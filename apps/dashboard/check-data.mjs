import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('./src/data.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {generate,defaults,validate,mean}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const a=generate(defaults,1),b=generate(defaults,2);
assert.deepEqual(a.users,b.users,'固定种子必须复现用户与时隙记录');
assert.equal(validate({...defaults,group:5}),'垂直阵子行数必须能被每通道阵子数整除');
assert.ok(validate({...defaults,slots:NaN}));
assert.equal(validate(defaults),null);
for(const u of a.users){
 assert.ok(u.ibler>=0&&u.ibler<=100);
 assert.equal(u.throughput,mean(u.samples.map(s=>s.throughput)));
 for(const s of u.samples){assert.ok(Number.isInteger(s.mcs)&&s.mcs>=0&&s.mcs<=28);assert.ok([1,2].includes(s.rank));if(!s.scheduled||s.error)assert.equal(s.throughput,0);}
}
console.log('PASS: reproducibility, validation, metric consistency, discrete values');
