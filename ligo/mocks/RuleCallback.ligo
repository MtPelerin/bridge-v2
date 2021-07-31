#include "../rules/common/Types.ligo"
#include "../common/Utils.ligo"

function main (const param : isTransferValidResult; var _store : option(isTransferValidResult)) : (list(operation) * option(isTransferValidResult)) is (noOperations, Some (param))


