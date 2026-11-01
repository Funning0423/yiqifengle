#!/usr/bin/env node
'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const r=spawnSync(process.execPath,[path.join(__dirname,'test_node_board_pose.cjs')],{stdio:'inherit',env:process.env});
process.exit(r.status||0);
