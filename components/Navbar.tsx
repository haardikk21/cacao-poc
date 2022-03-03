interface NavbarProps {
  getProviderOrSigner: (needSigner: boolean) => Promise<any>;
  walletConnected: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  getProviderOrSigner,
  walletConnected,
}) => {
  return (
    <div className="py-4 px-4 bg-orange-500 flex justify-between items-between">
      <span className="text-2xl font-medium">CACAO PoC</span>
      <button
        disabled={walletConnected}
        className="px-4 py-2 bg-red-100 hover:bg-red-300 cursor-pointer rounded-lg"
        onClick={() => getProviderOrSigner(true)}
      >
        {walletConnected ? "Connected" : "Connect Wallet"}
      </button>
    </div>
  );
};

export default Navbar;
