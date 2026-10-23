import test from "node:test";
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {askHermesCli,probeHermesCli} from "../src/cli.mjs";

function fakeSpawn(expectedArgs,output="success",exitCode=0,seen={}) {
  return (command,args,options)=>{
    assert.equal(command,"hermes");
    assert.deepEqual(args,expectedArgs);
    assert.equal(options.shell,false);
    assert.deepEqual(options.stdio,["pipe","pipe","pipe"]);
    const child=new EventEmitter();
    child.stdin=new PassThrough();
    child.stdout=new PassThrough();
    child.stderr=new PassThrough();
    child.kill=()=>{};
    let input="";
    child.stdin.on("data",c=>input+=c.toString());
    child.stdin.on("end",()=>{
      seen.prompt=input;
      setImmediate(()=>{child.stdout.write(output);child.stdout.end();child.emit("close",exitCode);});
    });
    return child;
  };
}

test("Hermes CLI probe checks binary version without model/tool claims",async()=>{
  const p=await probeHermesCli({spawnImpl:fakeSpawn(["--version"],"hermes 0.x")});
  assert.deepEqual(p,{installed:true,version:"hermes 0.x",toolsetsVerified:false});
});
test("CLI sends BUAP context + user prompt via stdin, not argv/shell",async()=>{
  const seen={};
  const result=await askHermesCli({prompt:"Find bug",systemContext:"BUAP agent profile",spawnImpl:fakeSpawn(["chat","--oneshot","--query-file","-","--quiet"],"Found it.",0,seen)});
  assert.equal(result.text,"Found it.");
  assert.equal(result.source,"hermes-cli");
  assert.ok(seen.prompt.includes("BUAP agent profile"));
  assert.ok(seen.prompt.endsWith("Find bug"));
});
test("CLI refuses failed turns without exposing stderr",async()=>{
  await assert.rejects(()=>askHermesCli({prompt:"Hi",spawnImpl:fakeSpawn(["chat","--oneshot","--query-file","-","--quiet"],"partial",1)}),/exit code 1/);
});
test("CLI refuses invalid executable path and invalid prompts",async()=>{
  await assert.rejects(()=>askHermesCli({prompt:"Hi",command:"\nsh"}),/executable path/);
  await assert.rejects(()=>askHermesCli({prompt:""}),/nonempty/);
});
