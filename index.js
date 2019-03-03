/**
 * https server
 */
//使用nodejs自带的https模块
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const Koa = require("koa");
const net = require("net");

const content = require("./util/content");
const mimes = require("./util/mimes");

const app = new Koa();
const staticPath = "./static";

// 解析资源类型
function parseMime(url) {
  let extName = path.extname(url);
  extName = extName ? extName.slice(1) : "unknown";
  return mimes[extName];
}

app.use(async ctx => {
  // 静态资源目录在本地的绝对路径
  let fullStaticPath = path.join(__dirname, staticPath);
  // 获取静态资源内容，有可能是文件内容，目录，或404
  let _content = await content(ctx, fullStaticPath);
  // 解析请求内容的类型
  let _mime = parseMime(ctx.url);
  // 如果有对应的文件类型，就配置上下文的类型
  if (_mime) {
    ctx.type = _mime;
  }
  // 输出静态资源内容
  if (_mime && _mime.indexOf("image/") >= 0) {
    // 如果是图片，则用node原生res，输出二进制数据
    ctx.res.writeHead(200);
    ctx.res.write(_content, "binary");
    ctx.res.end();
  } else {
    // 其他则输出文本
    ctx.body = _content;
  }
});

//根据项目的路径导入生成的证书文件
const privateKey = fs.readFileSync(
  path.join(__dirname, "./certificate/private.pem"),
  "utf8"
);
const certificate = fs.readFileSync(
  path.join(__dirname, "./certificate/ca.cer"),
  "utf8"
);
const credentials = { key: privateKey, cert: certificate };
//创建http与HTTPS服务器
const httpServer = http.createServer(app.callback());
const httpsServer = https.createServer(credentials, app.callback());
//可以分别设置http、https的访问端口号
const PORT = 1988;
const SSLPORT = 1989;
const FINAlPORT = 9999;

//创建https服务器
httpServer.listen(PORT, () => {});
httpsServer.listen(SSLPORT, () => {});

net
  .createServer(function(socket) {
    socket.once("data", function(buf) {
      // https数据流的第一位是十六进制“16”，转换成十进制就是22
      var address = buf[0] === 22 ? SSLPORT : PORT;
      //创建一个指向https或http服务器的链接
      var proxy = net.createConnection(address, function() {
        proxy.write(buf);
        //反向代理的过程，tcp接受的数据交给代理链接，代理链接服务器端返回数据交由socket返回给客户端
        socket.pipe(proxy).pipe(socket);
      });
      proxy.on("error", function(err) {
        console.log(err);
      });
    });
    socket.on("error", function(err) {
      console.log(err);
    });
  })
  .listen(FINAlPORT, () => {
    console.log("[demo] static-server is starting at port " + FINAlPORT);
  });
