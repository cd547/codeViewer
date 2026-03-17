let tools = require("../lib/tools");
let userModule = require("../module/admin/user");
let serverModule = require("../module/server");
let crmModel = require("../module/crm");
let system = require("../module/system")
let moment = require("moment");
module.exports = {
    "base":async function(req,res){
        let time  = new Date();
        let userCount = await userModule.getMyUserList({},1);
        userCount = userCount[0].count;
        let request = await serverModule.request(time);
        let request1 = await serverModule.request(new Date(time.getTime() - (1*24*60*60*1000)));
        let request2 = await serverModule.request(new Date(time.getTime() - (2*24*60*60*1000)));
        let request3 = await serverModule.request(new Date(time.getTime() - (3*24*60*60*1000)));
        let request4 = await serverModule.request(new Date(time.getTime() - (4*24*60*60*1000)));
        let request5 = await serverModule.request(new Date(time.getTime() - (5*24*60*60*1000)));
        let request6 = await serverModule.request(new Date(time.getTime() - (6*24*60*60*1000)));
        let request7 = await serverModule.request(new Date(time.getTime() - (7*24*60*60*1000)));
        let clue = await system.selectTableList({count:1},"clue")
        let numKey = `xtapi_request_${moment().format("YYYYMMDD")}`;
        let apis_s = await global.redis.redisSession.get(numKey);
        res.json(tools.jsonData({
            request:request,
            userCount:userCount,
            collection:3000,
            clue:clue[0].count,
            apis_s:apis_s,
            requests:[
                request,
                request1,
                request2,
                request3,
                request4,
                request5,
                request6,
                request7
            ]
        }))
    }
}