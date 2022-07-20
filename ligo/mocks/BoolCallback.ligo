#include "../common/Utils.ligo"

function main (const param : bool; var _store : option(bool)) : (list(operation) * option(bool)) is (noOperations, Some (param))


