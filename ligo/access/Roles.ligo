#include "../common/Utils.ligo"

type roles is big_map(bytes, bool);

module ROLES is {
  function pack(const role: string; const account : address) : (bytes) is Bytes.pack((role, account));

  function hasRole (const roles: roles; const role: string; const account : address) : (bool) is
    block {
      assert((account =/= burn_address)); (* "Roles: account is the zero address" *)
      const packed = pack(role, account);
    } with ((case roles[packed] of | None -> False | Some(x) -> x end));

  function addRole (var roles: roles; const role: string; const account : address) : (roles) is
    block {
      assert(not(hasRole(roles, role, account))); (* "Roles: account already has role" *)
      const packed = pack(role, account);
      roles[packed] := True;
    } with roles;

  function removeRole (var roles: roles; const role: string; const account : address) : (roles) is
    block {
      assert(hasRole(roles, role, account)); (* "Roles: account does not have role" *)
      const packed = pack(role, account);
      roles[packed] := False;
    } with roles;
}
