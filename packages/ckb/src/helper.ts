import ecc from 'tiny-secp256k1'
import randomBytes from 'randombytes'
import Decimal from 'decimal.js'
import ECPair from '@nervosnetwork/ckb-sdk-utils/lib/ecpair'
import {
  AddressType,
  bech32,
  pubkeyToAddress,
  rawTransactionToHash,
} from '@nervosnetwork/ckb-sdk-utils'
import { serializeTransaction as sdkSerializeTransaction } from '@nervosnetwork/ckb-sdk-utils/lib/serialization/transaction'
import paramsFormatter from '@nervosnetwork/ckb-sdk-rpc/lib/paramsFormatter'
import resultFormatter from '@nervosnetwork/ckb-sdk-rpc/lib/resultFormatter'

import {
  IKeypair, IUTXOUnspent,
  OneChainError,
  helper as coreHelper,
} from '@onechain/core'

import { MAINNET, TESTNET } from './const'
import { IScript } from './interface'
import LockUtils from './lock-utils'

const toSnakeCaseTransaction = paramsFormatter.toRawTransaction
const toCamelCaseTransaction = resultFormatter.toTransaction
export { toSnakeCaseTransaction, toCamelCaseTransaction }

export const {
  isNil,
  isInteger,
  isNumber,
  isDecimal,
  isArray,
  cloneDeep,
  sumBy,
  find,
  reverse,
  trimEnd,
  filter,
  values,
  isUTXOTransaction,
  isHex,
  padHexPrefix,
  stripHexPrefix,
  isValidMnemonic,
  isValidMnemonicChecksum,
  generateMnemonic,
  mnemonicToSeed,
  mnemonicToSeedSync,
  deriveFromSeed,
  deriveFromMnemonic,
  deriveFromMnemonicSync,
  binaryStringToBuffer,
} = coreHelper

/**
 * Is valid address
 *
 * @param {string} addressStr
 * @return {boolean}
 */
export function isValidAddress (addressStr: string): boolean {
  try {
    bech32.decode(addressStr)
  }
  catch (err) {
    return false
  }
  return true
}

/**
 * Is valid public key
 *
 * @param {string} publicKeyStr
 * @return {boolean}
 */
export function isValidPublicKey (publicKeyStr: string): boolean {
  const publicKeyBuf = Buffer.from(stripHexPrefix(publicKeyStr), 'hex')
  return ecc.isPoint(publicKeyBuf)
}

/**
 * Is valid private key
 *
 * Range of private key: https://en.bitcoin.it/wiki/Private_key
 *
 * @param {string} privateKeyStr
 * @return {boolean}
 */
export function isValidPrivateKey (privateKeyStr: string): boolean {
  let privateKeyBuf = Buffer.from(stripHexPrefix(privateKeyStr), 'hex')
  privateKeyBuf = Buffer.concat([Buffer.alloc((32 - privateKeyBuf.length)), privateKeyBuf])
  return ecc.isPrivate(privateKeyBuf)
}

export function getNetworkByChainId (chainId: string): any {
  let network

  switch (chainId) {
    case 'mainnet':
      network = MAINNET
      break
    case 'testnet':
      network = TESTNET
      break
    default:
      throw OneChainError.fromCode(10)
  }

  return network
}

/**
 * Generate keypair by network
 *
 * @param network
 * @return {IKeypair}
 */
export function generateKeypairByNetwork (network: any): IKeypair {
  let num
  do {
    num = randomBytes(32)
  } while (!ecc.isPrivate(num))

  const ecpair: ECPair = new ECPair(num)

  return {
    address: pubkeyToAddress(ecpair.publicKey, {
      prefix: network.addressPrefix,
      type: AddressType.HashIdx,
      codeHashOrCodeHashIndex: '0x00'
    }),
    publicKey: ecpair.publicKey,
    privateKey: ecpair.privateKey,
    wif: ecpair.privateKey,
  }
}

/**
 * Generate keypair
 *
 * @param {string} chainId
 * @return {IKeypair}
 */
export function generateKeypair (chainId: string): IKeypair {
  return generateKeypairByNetwork(getNetworkByChainId(chainId))
}

/**
 * Derive keypair from private key base on network
 *
 * @param {string} privateKey
 * @param {any} network
 * @return {IKeypair}
 */
export function privateKeyToAddressByNetwork (privateKey: string, network: any): IKeypair {
  if (!isValidPrivateKey(privateKey)) {
    throw OneChainError.fromCode(12)
  }

  const privateKeyBuf = Buffer.from(stripHexPrefix(privateKey), 'hex')
  const ecpair = new ECPair(privateKeyBuf)

  return {
    address: pubkeyToAddress(ecpair.publicKey, {
      prefix: network.addressPrefix,
      type: AddressType.HashIdx,
      codeHashOrCodeHashIndex: '0x00'
    }),
    publicKey: ecpair.publicKey,
    privateKey: ecpair.privateKey,
    wif: ecpair.privateKey,
  }
}

/**
 * Derive keypair from private key
 *
 * @param {string} privateKey
 * @param {string} chainId
 * @return {IKeypair}
 */
export function privateKeyToAddress (privateKey: string, chainId: string): IKeypair {
  return privateKeyToAddressByNetwork(privateKey, getNetworkByChainId(chainId))
}

/**
 * Convert lock script to address base on network
 *
 * @param {IScript | RPC.Script} lockScript
 * @param {INetwork} network
 * @returns {string}
 */
export function lockToAddressByNetwork (lockScript: any, network: any): string {
  return LockUtils.blake160ToAddress(lockScript.args, network.addressPrefix)
}

/**
 * Convert lock script to address
 *
 * @param {IScript | RPC.Script} lockScript
 * @param {string} chainId
 * @returns {string}
 */
export function lockToAddress (lockScript: any, chainId: string): string {
  const network = getNetworkByChainId(chainId)
  return lockToAddressByNetwork(lockScript, network)
}

/**
 * Serialize raw transaction
 *
 * @param tx
 * @returns {string}
 */
export function serializeRawTransaction (tx: any): string {
  return sdkSerializeTransaction(toCamelCaseTransaction(cloneDeep(tx)))
}

/**
 * Count raw transaction size
 *
 * @param tx
 * @returns {number}
 */
export function countRawTransactionSize (tx: any): number {
  const serializedTransaction = serializeRawTransaction(tx)
  return Buffer.byteLength(stripHexPrefix(serializedTransaction), 'hex')
}

/**
 * Get raw transaction ID
 *
 * @param tx
 * @returns {string}
 */
export function getRawTransactionID (tx: any): string {
  return rawTransactionToHash(toCamelCaseTransaction(cloneDeep(tx)))
}

/**
 * Parse raw transaction base on network
 *
 * @export
 * @param {any} rawTransaction
 * @param {IUTXOUnspent[]} [unspents=[]]
 * @param {INetwork} [network=null]
 * @return {any}
 */
export function parseRawTransactionByNetwork (rawTransaction: any, unspents: IUTXOUnspent[] = [], network: any = null): any {
  let fee = ''

  if (unspents.length > 0) {
    const inputValue = sumBy(unspents, 'value')
    const outputValue = sumBy(
      rawTransaction.outputs.map((output: any): any => ({ value: new Decimal(output.capacity) })),
      'value'
    )
    fee = inputValue.sub(outputValue).toString()
  }

  return {
    txid: getRawTransactionID(rawTransaction),
    iscoinbase: false,
    fee: fee,
    block_height: 0,
    blockhash: '',
    blocktime: '1970-01-01T00:00:00+0000',
    confirmations: 0,
    inputs: rawTransaction.inputs.map((input: RPC.CellInput): any => {
      let fromAddress = ''
      let value = '0'
      if (unspents.length > 0) {
        const unspent = unspents.find((unspent: IUTXOUnspent) => {
          return input.previous_output.tx_hash === unspent.txId &&
            input.previous_output.index === new Decimal(unspent.vout).toHex()
        })
        if (unspent) {
          fromAddress = unspent.address
          value = Decimal.isDecimal(unspent.value) ? unspent.value.toString() : (unspent.value as string)
        }
      }

      return {
        from_address: fromAddress,
        from_txid: input.previous_output.tx_hash,
        vin_index: new Decimal(input.previous_output.index).toString(),
        value: value,
        sequence: '',
      }
    }),
    outputs: rawTransaction.outputs.map((output: RPC.CellOutput, index): any => {
      return {
        to_address: lockToAddressByNetwork(output.lock, network),
        vout_index: index,
        value: new Decimal(output.capacity).toString(),
        type: 'pubkeyhash',
        asm: '',
        hex: '',
      }
    }),
  }
}

/**
 * Parse raw transaction
 *
 * @export
 * @param {any} rawTransaction
 * @param {IUTXOUnspent[]} [unspents=[]]
 * @param {string} [chainId='mainnet']
 * @return {any}
 */
export function parseRawTransaction (rawTransaction: any, unspents: IUTXOUnspent[] = [], chainId = 'mainnet'): any {
  return parseRawTransactionByNetwork(rawTransaction, unspents, getNetworkByChainId(chainId))
}
