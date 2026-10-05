'use strict';
// Real installed-model evaluation with authored synthetic fixtures, never user memories.
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { corpus, cases } = require('./retrieval-evaluation.cjs');
const negatives = ['volcanic seismology', 'photosynthesis in ferns', 'Who won the football match?', 'How do I bake sourdough bread?', 'Explain lunar crater geology'];
const texts = [...corpus.map(([,title,content])=>title+'. '+content), ...cases.map(([,query])=>query), ...negatives];
const started=performance.now();
const output = JSON.parse(execFileSync('swift', [path.join(__dirname,'apple-embedding-probe.swift')], {input:JSON.stringify(texts),encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024}));
const processMs=performance.now()-started;
assert.equal(output.vectors.length,texts.length);
for(const vector of output.vectors){assert.equal(vector.length,output.dimensions);assert.ok(vector.every(Number.isFinite));}
const cosine=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0)/Math.sqrt(a.reduce((s,v)=>s+v*v,0)*b.reduce((s,v)=>s+v*v,0));
const rank=vector=>corpus.map(([id],i)=>({id,score:cosine(vector,output.vectors[i])})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
const rows=cases.map(([group,query,target],i)=>({group,query,target,ranking:rank(output.vectors[corpus.length+i])}));
const negativeRows=negatives.map((query,i)=>({query,ranking:rank(output.vectors[corpus.length+cases.length+i])}));
const thresholds=[0.25,0.35,0.45,0.55,0.65,0.75];
const sweeps=thresholds.map(threshold=>({threshold,groups:Object.fromEntries(['exact','paraphrase','natural-paraphrase'].map(group=>{const items=rows.filter(r=>r.group===group);return [group,{cases:items.length,recall:items.filter(r=>r.ranking.some(v=>v.id===r.target&&v.score>=threshold)).length,top1:items.filter(r=>r.ranking[0].id===r.target&&r.ranking[0].score>=threshold).length}]})),negativeQueriesSelected:negativeRows.filter(r=>r.ranking[0].score>=threshold).length}));
console.log(JSON.stringify({model:output.model,revision:output.revision,dimensions:output.dimensions,texts:output.texts,inferenceMs:output.inferenceMs,processMs,scope:'synthetic authored diagnostic; threshold sweep is exploratory, not held-out validation; semantic-only ranking, not production hybrid',rows:rows.map(r=>({...r,ranking:r.ranking.map(v=>({...v,score:Number(v.score.toFixed(4))}))})),negatives:negativeRows.map(r=>({query:r.query,top1:r.ranking[0].id,score:Number(r.ranking[0].score.toFixed(4))})),sweeps},null,2));
