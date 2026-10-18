.PHONY: nop deploy

nop:

.dummy-app/out/app.zip: .dummy-app/app/index.mjs
	mkdir -p $(@D)
	(cd $(<D) && zip -r $(CURDIR)/.dummy-app/out/app.zip .)

app.zip: handler/index.mjs
	(cd handler && zip -r ../app.zip .)

BUCKET_NAME := lambdawebfntest-bucket83908e77-0dou1gfyu8fl
UPDATER_NAME := LambdaWebFnTest-Updater65AF1523-U5WaKAC5njtR

deploy: app.zip
	aws s3 cp $< s3://$(BUCKET_NAME)/app.zip
	#aws lambda invoke --function-name $(UPDATER_NAME) /dev/null
