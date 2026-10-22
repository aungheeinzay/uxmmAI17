const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV='test';
process.env.DATABASE_URL='postgresql://test:test@localhost:5432/test';
const repo=require('../dist/modules/auth/auth.repository');
const users=require('../dist/modules/users/user.repository');
const accounts=new Map(), sessions=new Map(), tokensByHash=new Map();
const emails=[];
require("../dist/lib/email/email.service").sendAccountEmail=async(email,purpose,token)=>emails.push({email,purpose,token});
repo.reserveEmailToken=async(accountId,purpose,tokenHash)=>{tokensByHash.set(tokenHash,accountId);return true;};
repo.consumeVerificationToken=async hash=>{const id=tokensByHash.get(hash);if(!id)return false;tokensByHash.delete(hash);[...accounts.values()].find(a=>a.id===id).emailVerifiedAt=new Date();return true;};
repo.createAccount=async(email,passwordHash)=>{
 if(accounts.has(email))throw {code:'P2002'};
 const id=randomUUID();const a={id,email,passwordHash,emailVerifiedAt:null,profile:{id,role:'SME',fullName:null,phone:null}};
 accounts.set(email,a);return a;
};
repo.findAccount=async email=>accounts.get(email)||null;
repo.createSession=async data=>{const s={id:randomUUID(),...data};sessions.set(s.id,s);return s;};
repo.findSession=async hash=>{const s=[...sessions.values()].find(s=>s.accessHash===hash);return s?{...s,account:[...accounts.values()].find(a=>a.id===s.accountId)}:null;};
repo.rotateSession=async(hash,data)=>{const s=[...sessions.values()].find(s=>s.refreshHash===hash&&s.refreshExpiresAt>new Date());if(!s)return null;Object.assign(s,data);return [...accounts.values()].find(a=>a.id===s.accountId);};
repo.revokeSession=async hash=>{for(const [id,s]of sessions)if(s.accessHash===hash)sessions.delete(id);};
users.findProfile=async id=>[...accounts.values()].find(a=>a.id===id)?.profile;
users.updateProfile=async(id,data)=>Object.assign([...accounts.values()].find(a=>a.id===id).profile,data);
const {app}=require('../dist/app');
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{await new Promise(r=>server.close(r));await require('../dist/config/prisma').prisma.$disconnect();});
async function request(path,body,token,method='POST'){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
test('registration, login, expiry, rotation and immediate logout',async()=>{
 const credentials={email:'User@example.com',password:'correct-password'};
 const registered=await request('/api/auth/register',credentials);
 assert.equal(registered.status,201);assert.equal(registered.body.data.confirmationRequired,true);
 assert.equal(registered.body.data.accessToken,undefined);assert.equal(sessions.size,0);
 assert.equal(accounts.get("user@example.com").profile.role,"SME");
 assert.equal((await request("/api/auth/login",credentials)).status,403);
 assert.equal((await request("/api/auth/verify-email",{token:emails[0].token})).status,200);
 const initialLogin=await request("/api/auth/login",credentials);const tokens=initialLogin.body.data;
 const account=accounts.get('user@example.com');assert.notEqual(account.passwordHash,credentials.password);
 assert.ok(!JSON.stringify([...sessions.values()]).includes(tokens.accessToken));
 assert.equal((await request('/api/auth/register',credentials)).status,409);
 assert.equal((await request('/api/auth/register',{...credentials,role:'OPERATOR'})).status,400);
 for(const email of ['user@example.com','missing@example.com']) assert.equal((await request('/api/auth/login',{email,password:'wrong'})).status,401);
 const login=await request('/api/auth/login',credentials);assert.equal(login.status,200);
 assert.equal((await request('/api/users/me',undefined,login.body.data.accessToken,'GET')).status,200);
 assert.equal((await request('/api/users/me',undefined,undefined,'GET')).status,401);
 assert.equal((await request('/api/users/me',undefined,'invalid','GET')).status,401);
 assert.equal((await request('/api/users/me',{role:'OPERATOR'},tokens.accessToken,'PATCH')).status,400);
 assert.equal((await request('/api/users/me',{fullName:'Test'},tokens.accessToken,'PATCH')).body.data.fullName,'Test');
 const rotated=await request('/api/auth/refresh',{refreshToken:tokens.refreshToken});assert.equal(rotated.status,200);
 assert.notEqual(rotated.body.data.refreshToken,tokens.refreshToken);
 assert.equal((await request('/api/auth/refresh',{refreshToken:tokens.refreshToken})).status,401);
 assert.equal((await request('/api/users/me',undefined,tokens.accessToken,'GET')).status,401);
 const active=rotated.body.data;
 assert.equal((await request('/api/auth/logout',undefined,active.accessToken)).status,200);
 assert.equal((await request('/api/users/me',undefined,active.accessToken,'GET')).status,401);
 assert.equal((await request('/api/auth/refresh',{refreshToken:active.refreshToken})).status,401);
 for(const s of sessions.values()){s.accessExpiresAt=new Date(0);s.refreshExpiresAt=new Date(0);}
 assert.equal((await request('/api/users/me',undefined,login.body.data.accessToken,'GET')).status,401);
 assert.equal((await request('/api/auth/refresh',{refreshToken:login.body.data.refreshToken})).status,401);
});
test('passwords use distinct salts and verify correctly',async()=>{
 const {hashPassword,verifyPassword}=require('../dist/modules/auth/auth.password');
 const one=await hashPassword('password123'),two=await hashPassword('password123');
 assert.notEqual(one,two);assert.equal(await verifyPassword('password123',one),true);assert.equal(await verifyPassword('wrong',one),false);
});

test('operational deactivation blocks an existing session and future Rider logins', async () => {
 const { hashPassword } = require('../dist/modules/auth/auth.password');
 const id = randomUUID(), email = `deactivated-rider-${id}@example.test`, password = 'deactivated-rider-password';
 accounts.set(email, { id, email, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(),
   profile: { id, role: 'RIDER', fullName: 'Fictional Rider', phone: '09123456789', providerId: randomUUID(), deactivatedAt: null } });
 const login = await request('/api/auth/login', { email, password });
 assert.equal(login.status, 200);
 assert.equal((await request('/api/users/me', undefined, login.body.data.accessToken, 'GET')).status, 200);
 accounts.get(email).profile.deactivatedAt = new Date();
 assert.equal((await request('/api/users/me', undefined, login.body.data.accessToken, 'GET')).status, 401);
 const blocked = await request('/api/auth/login', { email, password });
 assert.equal(blocked.status, 403); assert.equal(blocked.body.error.code, 'ACCOUNT_DEACTIVATED');
 accounts.get(email).profile.deactivatedAt = null;
 assert.equal((await request('/api/auth/login', { email, password })).status, 200);
});
test('existing verified Operator without provider membership can still log in', async () => {
 const { hashPassword } = require('../dist/modules/auth/auth.password');
 const id = randomUUID(), email = `operator-${id}@example.test`, password = 'membership-test-password';
 accounts.set(email, { id, email, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), profile: { id, role: 'OPERATOR', fullName: 'Operator', phone: null, providerId: null } });
 const login = await request('/api/auth/login', { email, password });
 assert.equal(login.status, 200);
 const me = await request('/api/users/me', undefined, login.body.data.accessToken, 'GET');
 assert.equal(me.status, 200); assert.equal(me.body.data.role, 'OPERATOR'); assert.equal(me.body.data.providerId, null);
});
