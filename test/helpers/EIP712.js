const { ecsign } = require("ethereumjs-util");

const PRIVATE_KEYS = [
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120a",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120b",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120c",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120d",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120e",
  "0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120f",
];

const strip0x = (v) => {
  return v.replace(/^0x/, "");
};

const hexStringFromBuffer = (buf) => {
  return "0x" + buf.toString("hex");
};

const bufferFromHexString = (hex) => {
  return Buffer.from(strip0x(hex), "hex");
};

const ecSign = (digest, privateKey) => {
  const { v, r, s } = ecsign(
    bufferFromHexString(digest),
    bufferFromHexString(privateKey)
  );
  
  return { v, r: hexStringFromBuffer(r), s: hexStringFromBuffer(s) };
};

const signEIP712 = (domainSeparator, typeHash, types, parameters, privateKey) => {
  const digest = web3.utils.keccak256(
    "0x1901" +
      strip0x(domainSeparator) +
      strip0x(
        web3.utils.keccak256(
          web3.eth.abi.encodeParameters(
            ["bytes32", ...types],
            [typeHash, ...parameters]
          )
        )
      )
  );

  return ecSign(digest, privateKey);
};

module.exports = {
  strip0x,
  hexStringFromBuffer,
  bufferFromHexString,
  ecSign,
  signEIP712,
  PRIVATE_KEYS,
};