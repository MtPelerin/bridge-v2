#include "../common/Utils.ligo"

function main (const param : (nat * nat); var _store : option((nat * nat))) : (list(operation) * option((nat * nat))) is (noOperations, Some (param))


