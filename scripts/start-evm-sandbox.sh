#!/bin/bash
ganache_port=8545

# We define 16 accounts with balance 1M ether, needed for high-value tests.
accounts=(
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120a,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120b,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120c,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120d,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120e,1000000000000000000000000"
--account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120f,1000000000000000000000000"
)

npx ganache-cli --gasLimit 0xfffffffffff --port "$ganache_port" "${accounts[@]}"
