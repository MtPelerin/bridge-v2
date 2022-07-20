const noOperations: list(operation) = nil;
const burn_address : address = ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);
const emptyIntList : list(int) = (list [] : list(int));
const emptyAddressList : list(address) = (list [] : list(address));
const emptyNatList : list(nat) = (list [] : list(nat));
const ref_currency: string = "CHF";
const max_decimals: nat = 20n;

function require (const assertion : bool; const message: string) : (unit) is
  block {
    if assertion =/= True then failwith(message) else skip;
  } with (unit);

recursive function _pow(const a : nat; const n : nat; const acc : nat) : nat is if n = 0n then acc else _pow(a, abs(n - 1), a * acc);