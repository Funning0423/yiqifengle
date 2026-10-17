import json,sys,re,collections
# usage: errs.py tag.json worldFlowLog.txt srvlog
J=json.load(open(sys.argv[1]));W=open(sys.argv[2]).read().split('\n');S=open(sys.argv[3]).read().split('\n')
A=J['errors']
B=collections.Counter()
for l in W:
    p=l.split('\t')
    if len(p)>=3 and p[1]=='error':
        m=p[2]
        if m.startswith('Failed to load resource'):continue
        B[re.sub(r'\d{6,}','N',m[:160])]+=1
fl=[l for l in W if '\terror\tFailed to load resource' in l]
C=[(t,s,u) for t,s,u in J['net']]
srv=[]
for l in S:
    m=re.search(r'"(GET|HEAD) (\S+) HTTP/[\d.]+" (\d{3})',l)
    if m and int(m.group(3))>=400:srv.append((m.group(2),int(m.group(3))))
ok=set(u for t,u in J.get('ok200',[]))
okt={}
for t,u in J.get('ok200',[]):okt.setdefault(u,[]).append(t)
D=[]
for t,u,e in J.get('failed',[]):
    later=[x for x in okt.get(u,[]) if x>t]
    wl=(t<=2.0 and bool(later) and any(k in (e or '') for k in ('RESET','ABORTED')))
    D.append((t,u,e,bool(later),wl))
Cs=set((u,s) for u,s in srv)|set((u,s) for t,s,u in C)
Cwl=[x for x in Cs if x[0].startswith('/favicon.ico') and x[1]==404]
print('A pageerror',len(A),A[:3])
print('B console.error(去重，不含 Failed to load resource 回显)',sum(B.values()),dict(B))
print('  (Failed to load resource 回显条数',len(fl),')')
print('C HTTP>=400',len(Cs),sorted(Cs),'白名单(favicon 404)',len(Cwl))
print('D 网络失败',len(D),'白名单(前2s且后来200的RESET/ABORTED)',sum(x[4] for x in D))
for x in D:print('   %.3f %s %s 后来200=%s 白名单=%s'%x)
print('E 脚本错误',J.get('scriptErr'),[m for m in J['marks'] if m[1] in('FAIL','homeFail','homeFail2','islandViaBtnFail','audioFail')])
print('服务器请求数',sum(1 for l in S if '"GET' in l))
