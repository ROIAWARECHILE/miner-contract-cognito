-- Enable realtime for contract updates
ALTER TABLE contracts REPLICA IDENTITY FULL;
ALTER TABLE payment_states REPLICA IDENTITY FULL;
ALTER TABLE contract_tasks REPLICA IDENTITY FULL;

-- Add these tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_states;
ALTER PUBLICATION supabase_realtime ADD TABLE contract_tasks;