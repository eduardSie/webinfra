import boto3
from botocore.exceptions import ClientError

REGION = 'us-east-1'         
INSTANCE_ID = 'i-01ffae190cd2ef579' 

def stop_instance():
    ec2_client = boto3.client('ec2', region_name=REGION)
    
    try:
        print(f"Attempting to stop instance: {INSTANCE_ID}...")
        response = ec2_client.stop_instances(
            InstanceIds=[INSTANCE_ID],
            DryRun=False
        )
        
        current_state = response['StoppingInstances'][0]['CurrentState']['Name']
        print(f"Success! Instance {INSTANCE_ID} state is now: {current_state}")
        
    except ClientError as e:
        print(f"Error stopping instance {INSTANCE_ID}: {e}")

if __name__ == '__main__':
    stop_instance()