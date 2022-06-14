#include "../common/Utils.ligo"

function main (const param : unit; var _store : option(timestamp)) : (list(operation) * option(timestamp)) is (noOperations, Some (Tezos.now))


