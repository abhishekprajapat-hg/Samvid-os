import ContactDatabasePage from "./components/ContactDatabasePage";

const BrokerDatabase = () => (
  <ContactDatabasePage
    kind="BROKER"
    title="Broker Database"
    blurb="Brokers and channel partners on file. Any enquiry arriving on one of these numbers is refused before it becomes a lead, whether it comes from the Meta form, a bulk sheet or someone adding it by hand, so the pipeline stays customer enquiries only. Remove a number from here to let it through again."
  />
);

export default BrokerDatabase;
