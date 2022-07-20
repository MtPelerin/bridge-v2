#include "../rules/common/Types.ligo"
#include "../common/Utils.ligo"

function main (const param : beforeTransferHookResult; var _store : option(beforeTransferHookResult)) : (list(operation) * option(beforeTransferHookResult)) is (noOperations, Some (param))


