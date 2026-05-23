-- Allow renaming server_name while keeping container_status rows linked
ALTER TABLE container_status
  DROP CONSTRAINT IF EXISTS container_status_server_name_fkey;

ALTER TABLE container_status
  ADD CONSTRAINT container_status_server_name_fkey
  FOREIGN KEY (server_name) REFERENCES server_status(server_name)
  ON DELETE CASCADE ON UPDATE CASCADE;
