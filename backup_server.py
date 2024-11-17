import falcon
import json


class BackupResource:
    def on_post(self, req, resp):
        # Get the JSON data from the request
        try:
            raw_json = req.stream.read()  # Read the raw stream data
            data = json.loads(raw_json)  # Parse the raw data as JSON
        except Exception as e:
            resp.status = falcon.HTTP_400  # Bad request
            resp.media = {"message": "Invalid JSON"}
            return
        try:
            with open("backup.txt", "w") as handle:
                handle.write(json.dumps(data))
                handle.close()

            resp.status = falcon.HTTP_200
        except Exception as error:
            resp.status = falcon.HTTP_500
            raise error

    def on_get(self, req, resp):
        try:
            try:
                with open("backup.txt", "r") as handle:
                    data = handle.read()
                    handle.close()
            except FileNotFoundError:
                data = "{}"
            resp.media = json.loads(data)
            resp.status = falcon.HTTP_200
        except Exception as error:
            resp.status = falcon.HTTP_500
            raise error



# Create the Falcon application
app = falcon.App(
    middleware=falcon.CORSMiddleware(allow_origins="*", allow_credentials="*")
)

# Create the resource and add a route for the POST endpoint
app.add_route("/backup", BackupResource())
