import type { NextPage } from "next";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import { JsonRpcSigner, Web3Provider } from "@ethersproject/providers";
import { CeramicClient } from "@ceramicnetwork/http-client";
import Navbar from "../components/Navbar";
import { TileDocument } from "@ceramicnetwork/stream-tile";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Ed25519Provider } from "key-did-provider-ed25519";
import * as KeyDidResolver from "key-did-resolver";
import { EthereumAuthProvider } from "@ceramicnetwork/blockchain-utils-linking";
import { DID } from "dids";
import type { Cacao } from "ceramic-cacao";

const CERAMIC_API_URL = "http://localhost:7007";

function useForceUpdate() {
  const [value, setValue] = useState(0); // integer state
  return () => setValue((value) => value + 1); // update the state to force render
}

const Home: NextPage = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [determinsticDocument, setDeterministicDocument] =
    useState<TileDocument<any>>();
  const [dappDidKey, setDappDidKey] = useState("");
  const [capability, setCapability] = useState<Cacao>();
  const [fooValue, setFooValue] = useState("");
  const [loading, setLoading] = useState(true);

  const forceUpdate = useForceUpdate();

  const web3ModalRef = useRef<Web3Modal>();

  const createDeterministicDocument = async () => {
    try {
      console.log("Creating determinstic TileDocument...");
      const address = await getAddress();
      const ceramic = getCeramicClient();
      const deterministicDocument = await TileDocument.deterministic(ceramic, {
        deterministic: true,
        family: Math.random().toString(36).substr(2, 5), // set a random family
        controllers: [`did:pkh:eip155:1:${address}`],
      });

      setDeterministicDocument(deterministicDocument);
      console.log("Determinstic TileDocument created", deterministicDocument);
      return deterministicDocument;
    } catch (error) {}
  };

  const getDappDidKey = async () => {
    // use hard coded seed for example
    const seed = new Uint8Array([
      69, 90, 79, 1, 19, 168, 234, 177, 16, 163, 37, 8, 233, 244, 36, 102, 130,
      190, 102, 10, 239, 51, 191, 199, 40, 13, 2, 63, 94, 119, 183, 225,
    ]);

    const didProvider = new Ed25519Provider(seed);
    const didKey = new DID({
      provider: didProvider,
      resolver: KeyDidResolver.getResolver(),
    });
    await didKey.authenticate();
    setDappDidKey(didKey.id);
    return didKey;
  };

  const updateDocumentFromDapp = async () => {
    if (determinsticDocument && capability) {
      console.log("Updating document from dApp...");
      const dappKey = await getDappDidKey();
      const dappKeyWithCap = dappKey.withCapability(capability);
      await dappKeyWithCap.authenticate();

      await determinsticDocument.update(
        {
          foo: fooValue,
        },
        {},
        {
          asDID: dappKeyWithCap,
          anchor: false,
          publish: false,
        }
      );

      console.log("Updated document...");
      forceUpdate();
    }
  };

  const requestCapability = async () => {
    try {
      if (!determinsticDocument) {
        window.alert("Determinstic document hasn't yet been created...");
      }
      const eap = await getEthereumAuthProvider();
      const didKey = await getDappDidKey();

      const cap = await eap.requestCapability(didKey.id, [
        `${determinsticDocument?.id.toUrl()}`,
      ]);

      setCapability(cap);
    } catch (error) {
      console.error(error);
    }
  };

  const getEthereumAuthProvider = async () => {
    const wrappedProvider = await getProviderOrSigner();
    const address = await getAddress();
    return new EthereumAuthProvider(wrappedProvider?.provider, address);
  };

  const getCeramicClient = () => {
    const ceramic = new CeramicClient(CERAMIC_API_URL);
    return ceramic;
  };

  const getAddress = async () => {
    const signer = await getProviderOrSigner(true);
    const address = await (signer as JsonRpcSigner).getAddress();
    return address;
  };

  const getProviderOrSigner = async (needSigner: boolean = false) => {
    try {
      if (web3ModalRef.current) {
        const provider = await web3ModalRef.current.connect();
        const wrappedProvider = new Web3Provider(provider);

        const { chainId } = await wrappedProvider.getNetwork();
        if (chainId !== 1) {
          window.alert("Please connect to mainnet instead");
          return;
        }

        setWalletConnected(true);

        if (needSigner) {
          const signer = wrappedProvider.getSigner();
          return signer;
        }

        return wrappedProvider;
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "mainnet",
        providerOptions: {
          walletconnect: {
            package: WalletConnectProvider,
            options: {
              infuraId: "460f40a260564ac4a4f4b3fffb032dad",
            },
          },
        },
        cacheProvider: true,
        disableInjectedProvider: false,
      });
    }

    if (walletConnected && !determinsticDocument) {
      console.log("HERE");
      getDappDidKey();
      createDeterministicDocument().then(() => setLoading(false));
    }
  }, [walletConnected]);

  return (
    <div>
      <Navbar
        getProviderOrSigner={getProviderOrSigner}
        walletConnected={walletConnected}
      />

      <div className="flex flex-col justify-center items-center p-4 bg-gray-100">
        <div className="">
          {determinsticDocument ? (
            <div className="flex flex-col space-y-4">
              <span> {determinsticDocument.id.toUrl()} has been created.</span>
              <span>
                Stream is controlled by{" "}
                <strong>{determinsticDocument.controllers.join(", ")}</strong>
              </span>
              <span>
                Stream is being updated by <strong>{dappDidKey}</strong>
              </span>
              <pre className="bg-gray-700 rounded-lg p-4 text-white">
                {JSON.stringify(determinsticDocument.content, null, 2)}
              </pre>
              {determinsticDocument.allCommitIds.map((cid, idx) => (
                <pre className="bg-gray-700 rounded-lg p-4 text-white">
                  Commit ID {idx}: {cid.toString()}
                </pre>
              ))}
            </div>
          ) : walletConnected ? (
            <img src="/loading.svg" className="animate-spin w-16" />
          ) : (
            <span>Please connect your wallet to continue</span>
          )}
        </div>

        {typeof capability === "undefined" ? (
          <div>
            {!loading && (
              <button
                className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white"
                onClick={requestCapability}
              >
                Authorize dApp
              </button>
            )}
          </div>
        ) : (
          <div>
            <input
              type="text"
              placeholder="bar"
              value={fooValue}
              onChange={(e) => setFooValue(e.target.value)}
            />
            <button
              className="mt-4 px-4 py-2 rounded-lg bg-green-300"
              onClick={updateDocumentFromDapp}
            >
              Update Document from dApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
